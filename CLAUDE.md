# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**The app is live in production at https://mecanicai.org with real users.** Read `MEMORIES.md` (production state, rules for not breaking production, decisions already taken, history), imported here:

@MEMORIES.md

## Repository layout

The git root holds a single app in `MecanicAI/`. All paths and commands below are relative to `MecanicAI/`.

MecanicAI is a mobile-first Spanish SaaS: the user picks a car (brand → model → year → engine) and chats with an AI mechanic (Google Gemini) that knows about that car. It also has a maintenance "health report", a repair diary with a PDF export, a shopping basket and a documents section, each one per car.

- `backend/`: Java 25, Spring Boot 4.1, Maven, PostgreSQL 17, Flyway, `com.google.genai` SDK
- `frontend/`: React 19, TypeScript, Vite 8, React Router 8, PWA
- `compose.yaml` + `Caddyfile` + `frontend/nginx.conf`: production deployment (db, backend, backup, nginx, Caddy)

`MecanicAI/README.md` (in Spanish) is the main reference for features, limits, the API table, Google OAuth and Gemini setup, and deployment. When you change one of those, update the README too.

**Language convention:** UI text, code comments, API error messages, commit messages and docs are all in Spanish. Keep it that way.

## Commands

Local start order is always DB → backend → frontend.

```bash
# Database (first time; afterwards: podman start mecanicai-db)
podman run -d --name mecanicai-db -p 5432:5432 \
  -e POSTGRES_DB=mecanicai -e POSTGRES_USER=mecanicai -e POSTGRES_PASSWORD=mecanicai \
  -v mecanicai-data:/var/lib/postgresql/data docker.io/library/postgres:17-alpine

# Backend (port 8080). Reads backend/.env (copy from .env.example)
cd backend && ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
./mvnw test                                   # all tests (no DB needed)
./mvnw test -Dtest=RateLimiterTest            # one class
./mvnw test -Dtest='RateLimiterTest#allowsUpToTheLimitEachMinute'  # one method

# Frontend (port 5173, proxies /api, /oauth2 and /login/oauth2 to :8080)
cd frontend && npm install && npm run dev
npm run lint          # oxlint
npm run typecheck     # tsc -b
npm run build         # tsc -b && vite build
npm run generate-pwa-assets   # after changing public/logo.svg
```

The frontend has no test runner. Verify frontend changes with `npm run lint && npm run build`.

CI (`.github/workflows/ci.yml` at the git root) runs `./mvnw test` and `npm run lint && npm run build` on every push to `main` and on pull requests. It only checks; it never deploys.

The `dev` profile uses `app.ai.provider=auto`. Without `GEMINI_API_KEY` it runs `MockAiClient` (demo answers). Without Google OAuth credentials, the app offers only guest mode. Production (`provider=gemini`) refuses to start without an API key.

## Backend architecture (`backend/src/main/java/com/mecanicai/`)

Code is organised by feature: `auth`, `user`, `vehicle`, `catalog`, `chat`, `ai`, `usage`, `maintenance` (health report), `repair`, `basket`, `document`, `mail`, plus `config` and `common`.

- **Configuration**: everything under `app.*` in `application.yml` binds to the `AppProperties` record. Tests build it positionally in `src/test/java/com/mecanicai/TestProps.java`, so adding or reordering a property means updating `TestProps.defaults()`. Limits reach the frontend through the `features` object of `GET /api/auth/me` (`AuthController.Features` ↔ `Features` in `frontend/src/api/types.ts`).
- **Errors**: throw `AppException` (`notFound`, `badRequest`, `quotaExceeded`, or a custom status and code). `GlobalExceptionHandler` turns it into `ApiError {code, message, usage?}`. The frontend `ApiError` in `api/http.ts` mirrors this, and UI logic often switches on `code`.
- **Security** (`config/SecurityConfig`): stateless auth with a self-issued JWT in an HttpOnly cookie (`JwtCookieAuthenticationFilter`, `JwtService`, `SessionCookies`). Every token carries a session id (`sid`) and tokens without one are rejected. Logout writes the `sid` to `revoked_session`, and logout and account deletion send `Clear-Site-Data: "cache"` so opened documents don't stay in the browser cache. CSRF protection is SameSite=Lax plus a required `X-MecanicAI` header on mutating requests (`CsrfHeaderFilter`; the frontend sends it via `CSRF_HEADER`). Authenticated routes are an **explicit allow-list of path prefixes** and everything else is `permitAll`. A new authenticated API prefix must be added there and covered in `SecurityRulesTest`. Google OAuth is wired only when the client id is configured.
- **AI** (`ai/`): `AiClient` is the provider interface (`streamChat`, `generateJson`, `isDemo`). `AiConfig` picks Gemini or the mock. `ModelFallback` tries the configured model list in order and moves a failing model (503/429, network error, or 404 for a retired model) to the end for 2 minutes. It starts no new attempt once 2 minutes have passed since the question. `PromptBuilder.normalize` trims the history to `MAX_HISTORY_CHARS` before merging same-role turns, because the guest history comes from the browser. Each plan (`app.plans.free/pro`) has its own model list. Demo results are never cached. The mechanic's system prompt is in `chat/PromptBuilder`.
- **Chat turn flow**: `ChatTurnService` checks the per-minute rate (`RateLimiter`, in memory, single instance), reserves daily quota (`UsageService.consume` → `Reservation`), saves the user message, then calls `ChatStreamer`. The streamer sends SSE on a virtual thread: `delta` events with `{text, reset?}`, then `done` or `error`. `reset: true` means the model fell back mid-answer and the client must discard the partial text. On AI failure or client abort, the reservation is refunded. Guest chat (`GuestChatController`) stores nothing: the browser sends the history, and quota is consumed in this order: IP network (`ClientNetwork`: IPv4, or IPv6 /64), then guest cookie, then the global guest total.
- **Quotas and caps**: daily and weekly counters are rows in `usage_counter` (`UsageService`). Per-account caps (vehicles, conversations, repairs, basket items, documents) call `UserService.lock(userId)` (`SELECT … FOR UPDATE` on `app_user`) before counting. Follow that pattern for any new capped resource.
- **Catalog**: static `src/main/resources/catalog/vehicles.json` (format `"Model": "1991-2004,2024-"`). Engine suggestions and maintenance plans come from the AI and are cached in the DB. Client-sent brand and model ids are checked through `CatalogService.canonical` before anything is cached.
- **Database**: Flyway migrations in `src/main/resources/db/migration/V{n}__*.sql`, with `ddl-auto: validate`. Any entity or schema change needs a new migration; never edit an existing one. Numbering skips V5, so the next one is V12.
- **Email**: `Mailer` is `SmtpMailer` when `MAIL_HOST` is set, otherwise `LogMailer` (writes to the log). `DocumentReminderService` runs daily for ITV and insurance expiry reminders.
- **Tests**: plain unit tests, plus one `@WebMvcTest` (`SecurityRulesTest`). No `@SpringBootTest` and no database.

## Frontend architecture (`frontend/src/`)

- `api/endpoints.ts` holds every backend call. `api/http.ts` `api()` adds the CSRF header and retries when nginx returns 429 for a burst. `api/sse.ts` `postStream()` parses the chat SSE stream.
- `context/SessionProvider.tsx` owns `/api/auth/me`, guest mode and the **guest garage**.
- **Guest vs. account duality** is the main cross-cutting pattern. Guests keep cars, conversations, repairs and basket items only in `sessionStorage` (`lib/guestGarage.ts`, `lib/guestMode.ts`). Each feature hook (`useBasket`, `useRepairs`, `useSavedReports`, …) branches on `me.authenticated`: the API for accounts (loaded with `lib/useAccountList.ts`), the session guest garage for guests. On Google login, guest data is imported into the account. Client-side limits and error messages mirror the server's, so keep both sides in sync. The documents feature is account-only.
- Layout: `pages/` holds route components, `features/<name>/` holds components, hooks and CSS per feature, `components/` holds shared UI, and `styles/tokens.css` holds design tokens. Routes are in `App.tsx`, and everything per-car lives under `/coche/:vehicleId/...`. The per-car sections are lazy-loaded with `lib/lazyPage.ts`, which reloads the app once if a chunk vanished after a deploy. They render inside a `Suspense` and a `PageErrorBoundary` in `AppShell`. Don't key that boundary by path: `ChatPage` must stay mounted when the URL goes from `…/consultas/nuevo` to `…/consultas/:id`.
- TypeScript settings: `verbatimModuleSyntax` (use `import type`), imports keep their `.ts`/`.tsx` extension, `noUnusedLocals` and `noUnusedParameters`.
- Static pages: legal pages (`public/privacidad.html`, `terminos.html`, `cookies.html`) and SEO guides (`public/guias.html`, `public/guias/*.html`) are plain HTML served as `/privacidad`, `/guias/x`, etc. (Vite middleware in `vite.config.ts`, `try_files` in nginx). To add a guide, copy an existing one and link it from `guias.html` and `sitemap.xml`. Update the legal pages if what data is stored or shared changes.

## Routing gotchas when adding pages

- `frontend/nginx.conf` only falls back to the SPA for `/` and `/coche/*`. Any other path returns a 404 status, on purpose for SEO. A new top-level SPA route needs a `location` block in `nginx.conf`.
- New backend path prefixes outside `/api` (or new static pages) may need adding to the PWA `navigateFallbackDenylist` in `vite.config.ts`, the Vite dev proxy, and the nginx proxy `location` regex.
- nginx also rate-limits `/api` (10 r/s, burst 40, 20 connections per IP).

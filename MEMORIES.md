# MEMORIES.md · Lo que hay que saber de MecanicAI antes de tocar nada

Contexto del proyecto para agentes y personas que llegan nuevas. **Complementa** a `CLAUDE.md` (arquitectura, comandos
y patrones del código) y a `MecanicAI/README.md` (funciones, API, configuración y despliegue paso a paso): aquí va lo
que no se deduce leyendo el código: el estado de producción, las decisiones tomadas y lo que ya ha pasado.

Última actualización: 2026-11-07.

## ⚠️ El proyecto está EN PRODUCCIÓN

- Web pública: **https://mecanicai.org**. `www.mecanicai.org`, `mecanicai.es` y `www.mecanicai.es` redirigen a ella
  (`REDIRECT_DOMAINS` en el `.env`, Caddy).
- **Tiene usuarios reales con datos personales**: cuentas de Google (nombre, email, foto), coches con matrícula,
  consultas con la IA, historial de reparaciones y **documentación del coche** (fotos o PDF del permiso de circulación, la ITV
  y el seguro, que pueden llevar DNI, dirección o número de póliza).
- En producción está **todo lo que hay en `main`**, incluida la Documentación (migración `V11`, commit del 2026-11-06).
- Servidor Linux en la Unión Europea con `docker compose`: `db` (PostgreSQL 17), `backend`, `backup`,
  `frontend` (nginx) y `caddy` (HTTPS automático). El código está en `/opt/mecanicai/MecanicAI` del servidor.
- Repositorio: GitHub `haytam-25/MECANIC_AI`, rama `main`. **No hay CI/CD**: el despliegue lo hace el usuario a mano en
  el servidor con `git pull && docker compose up -d --build`. Un push a `main` no despliega nada por sí solo.
- Copias de seguridad: servicio `backup`, cada día a las 04:00 (hora de España); se guardan 14 días en `backups/` del
  mismo servidor (la política de privacidad cuenta con esos 14 días).

### Reglas por estar en producción

1. **Migraciones Flyway**: solo se añaden nuevas (`V12__…` es la siguiente; la V5 no existe). **Nunca** editar,
   renumerar ni borrar una existente: ya están aplicadas en la base de datos real. Cada migración nueva tiene que
   funcionar sobre los datos que ya hay (columna nueva `NOT NULL` → con `DEFAULT`; nada de borrar datos sin que el usuario lo pida).
   Con `ddl-auto: validate`, si una entidad no cuadra con el esquema el backend no arranca y **la web se cae**.
2. **Configuración**: toda propiedad nueva de `app.*` necesita un valor por defecto razonable (en `application.yml` y
   con `@DefaultValue` en `AppProperties`) para que el `.env` del servidor siga sirviendo sin tocarlo. Recuerda actualizar
   `TestProps.defaults()`. Si hace falta una variable de entorno nueva, añádela también a `compose.yaml`, a
   `.env.example` y al README, y avisa al usuario de que debe ponerla en el servidor.
3. **Sesiones**: no cambiar a la ligera el formato del JWT, el nombre de la cookie ni `JWT_SECRET`: se cerraría la
   sesión de todos los usuarios.
4. **Privacidad (RGPD)**: si cambia qué datos se guardan, cuánto tiempo o con quién se comparten (IA, email, otro
   proveedor), actualiza `frontend/public/privacidad.html` (y `terminos.html` / `cookies.html` si toca). La matrícula y
   los documentos **nunca** se envían a la IA.
5. **SEO**: la web está indexada. nginx solo devuelve la SPA para `/` y `/coche/*`; el resto da 404 a propósito. Una ruta
   nueva de primer nivel necesita su `location` en `frontend/nginx.conf` (ver CLAUDE.md, "Routing gotchas").
6. **Commits: los hace siempre el usuario.** Al terminar unos cambios, el agente los deja sin confirmar en el árbol
   de trabajo, sin `git add`, `git commit` ni `git push`, y termina con un resumen de lo cambiado y un mensaje de
   commit propuesto en español. Tampoco despliega nada en el servidor.
7. **Secretos**: los `.env` (raíz = servidor, `backend/.env` = local) tienen claves reales y están en `.gitignore`:
   nunca subirlos ni copiar sus valores.
8. **Cuota de IA**: Gemini se usa con la capa gratuita y la comparten invitados y cuentas. Cualquier cambio que
   multiplique las llamadas a la IA (reintentos, prompts más largos, llamadas nuevas) gasta la cuota de todos.

## Qué es MecanicAI

SaaS en español pensado para el móvil (PWA instalable): eliges tu coche —marca → modelo → año → motorización— y le
preguntas a un **mecánico con IA** (Google Gemini) que conoce ese coche. Hecho por un solo desarrollador (haytam).
Mercado principal: España (también términos de Argentina/Chile: cédula, VTV, RTO).

| Función | Lo esencial | Límites |
| --- | --- | --- |
| Asistente del coche | Catálogo estático `catalog/vehicles.json` (~57 marcas, ~900 modelos). Motorizaciones sugeridas por la IA y cacheadas en BD. Matrícula opcional | 5 coches por cuenta |
| Chat con el mecánico | Streaming SSE, Markdown, detener/reintentar, dictado por voz | Invitado 5/día (20 por IP, 300 entre todos los invitados); cuenta 20/día; 6/min |
| Consultas guardadas | Por coche | 20 por cuenta (la 21ª borra la más antigua), 100 mensajes cada una |
| Informe médico | Estado de mantenimiento por colores; plan de mantenimiento de la IA cacheado (`maintenance_cache`) | Invitado 3/día; cuenta 20/semana (solo cuenta el primero de cada coche) |
| Historial de reparaciones | Diario por coche + exportar a PDF (jsPDF) | 30 por cuenta |
| Cesta | Lista de la compra por coche | 30 artículos por cuenta |
| Documentación | Solo con cuenta. 3 carpetas fijas (circulación, ITV, seguro) + propias. Fotos/PDF en `BYTEA`. Aviso por email de la ITV y el seguro | 10 archivos por cuenta, 5 MB cada uno, 10 secciones propias por coche, 12 subidas/min |
| Cuenta | Login con Google, eliminar la cuenta (RGPD) | Sesión de 7 días que se renueva sola |

- **Invitado frente a cuenta**: los invitados guardan coches, consultas, reparaciones y cesta solo en `sessionStorage`; al iniciar
  sesión con Google se importan a la cuenta. La Documentación no existe para invitados.
- **Plan PRO**: preparado en datos y configuración (`plan` FREE/PRO, `app.plans.pro`: 300 mensajes/día y otros modelos),
  pero **sin pago**: no hay Stripe. Se activa a mano con `UPDATE app_user SET plan = 'PRO' WHERE email = '…';`.
- **Otros**: páginas legales y guías SEO en HTML estático (`frontend/public/`), `robots.txt`, `sitemap.xml`.
- **Contra abusos**: nginx limita `/api` a 10 peticiones/s (ráfagas de 40) y 20 conexiones por IP; los límites por IP cuentan IPv4 o bloques
  IPv6 /64. Ver `app.limits` y `app.guest` en `application.yml`.

## Configuración actual (2026-11-07)

- **Login con Google**: la app está **publicada** en Google Auth Platform (entra cualquier cuenta; solo pide `openid`,
  `email` y `profile`, así que no hace falta verificarla). El cliente OAuth debe tener las dos redirecciones:
  `https://mecanicai.org/login/oauth2/code/google` y `http://localhost:5173/login/oauth2/code/google`. Si falta la de
  localhost, el login en local falla con `Error 400: redirect_uri_mismatch` (pasó el 2026-11-07). En local se entra por
  `http://localhost:5173` (no por `127.0.0.1` ni por la IP de la red local: Google no acepta IPs privadas).
- **Email** (avisos de caducidad de la ITV y el seguro): **Brevo** por SMTP (`smtp-relay.brevo.com:587`, gratis hasta
  300 al día), con el dominio `mecanicai.org` autenticado y remitente `avisos@mecanicai.org`. Configurado con `MAIL_*`
  en el `.env` del servidor y en `backend/.env`. Sin `MAIL_HOST` el backend usa `LogMailer` (solo escribe en el log).
  La revisión es diaria a las 10:00 (Europe/Madrid).
- **IA**: Gemini con la lista de modelos de cada plan (`app.plans.*.models`, empezando por Flash-Lite en el gratuito);
  `ModelFallback` pasa al siguiente si uno da 503/429. En local, sin `GEMINI_API_KEY`, responde `MockAiClient`.

## Decisiones tomadas (no cambiarlas sin preguntar)

- `app.limits.max-documents` se queda en **10 archivos por cuenta** entre todos los coches, y la app **no muestra la
  cifra** (decidido el 2026-11-07 después de revisarlo).
- Los archivos de la Documentación van **dentro de PostgreSQL** (`document_file.content`, `BYTEA`): sin almacenamiento
  externo. Entran en las copias de `pg_dump`.
- Las fotos se reducen en el navegador (2000 px, JPEG) antes de subirlas, y el servidor comprueba el tipo real del
  archivo (`FileTypes`): solo JPEG, PNG, WebP y PDF.
- Hay un cupo diario total para los invitados (`GUEST_DAILY_MESSAGES_TOTAL`, `GUEST_DAILY_LOOKUPS_TOTAL`) porque la
  cuota gratuita de Gemini es la misma para invitados y cuentas.
- Todo en español: interfaz, mensajes de error de la API, comentarios, commits y documentación.

## Historia (según `git log`)

| Fecha | Hito |
| --- | --- |
| 2026-09-29 | Primera versión funcionando en local |
| 2026-10-01 | Login con Google y modo invitado (5 preguntas; 20 con cuenta) |
| 2026-10-02 | Logo y páginas legales (privacidad, términos, cookies) |
| 2026-10-04 | Informe médico |
| 2026-10-08 | Rediseño; límites (5 coches, 20 consultas, sesión de 7 días, límite por IPv6 /64) |
| 2026-10-09 | Historial de reparaciones y su PDF |
| 2026-10-11 | Matrícula opcional |
| 2026-10-14 | Cesta; interfaz lista para producción |
| 2026-10-25 | Preparado el despliegue en el servidor; `mecanicai.es` como dominio redirigido |
| 2026-10-28 | SEO y guías; arreglo del conteo de informes médicos |
| 2026-11-04 | Google puede leer `/api/auth/me` (indexación) |
| 2026-11-06 | Respuesta del chat más fluida; sección **Documentación** |
| 2026-11-07 | `CLAUDE.md` y este `MEMORIES.md` |

## Pendiente y hoja de ruta

- Seguir comprobando en producción la Documentación (subidas, límites y avisos por email de Brevo).
- Suscripción PRO con **Stripe** (hoy el plan PRO solo se activa a mano).
- Otro proveedor de IA para PRO (p. ej. OpenAI): implementar `AiClient` y elegirlo según el plan.
- Migrar `GeminiAiClient` a la *Interactions API* de Gemini (Google la recomienda para proyectos nuevos).
- Fotos en el chat (testigos del cuadro, piezas).

## Si actualizas este archivo

Añade aquí lo que un agente no puede deducir del código: cambios en producción, decisiones del usuario con su fecha,
incidencias y cómo se resolvieron. Lo que ya explican `CLAUDE.md` o el README no se repite: se enlaza.

import react from '@vitejs/plugin-react'
import { defineConfig, type Connect, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En desarrollo, Vite reenvía la API y el login de Google al backend de Spring Boot,
// así el navegador ve un único dominio (necesario para las cookies de sesión).
const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'
// changeOrigin: false conserva la cabecera Host del navegador (como nginx en producción). Spring la usa para construir
// la URL a la que vuelve Google tras el login: http://localhost:5173/login/oauth2/code/google (y no la del puerto 8080).
const toBackend = { target: backend, changeOrigin: false }

// Las páginas legales son HTML estático (public/privacidad.html...). En producción nginx sirve /privacidad con
// privacidad.html; esto hace lo mismo con `npm run dev` y `npm run preview`.
const legalPage: Connect.NextHandleFunction = (req, _res, next) => {
  if (req.url) req.url = req.url.replace(/^\/(privacidad|terminos|cookies)(?=\?|$)/, '/$1.html')
  next()
}
const legalPages: Plugin = {
  name: 'paginas-legales',
  configureServer: (server) => void server.middlewares.use(legalPage),
  configurePreviewServer: (server) => void server.middlewares.use(legalPage),
}

export default defineConfig({
  plugins: [
    react(),
    legalPages,
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'MecanicAI · Tu mecánico con IA',
        short_name: 'MecanicAI',
        description: 'Elige tu coche y pregunta a un mecánico con inteligencia artificial: averías, ruidos, testigos y mantenimiento.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#1a1d21',
        background_color: '#0c0e10',
        categories: ['auto', 'utilities'],
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // El PDF del diario (jsPDF, ~430 kB) solo se descarga si se usa. html2canvas, DOMPurify y canvg (index.es)
        // son extras de jsPDF para convertir HTML y SVG que la app no usa
        globIgnores: ['**/repairPdf-*.js', '**/html2canvas-*.js', '**/purify.es-*.js', '**/index.es-*.js'],
        navigateFallback: '/index.html',
        // Nunca servir la app desde caché en rutas del backend (API, login con Google) ni en las páginas legales,
        // que son HTML estático
        navigateFallbackDenylist: [
          /^\/api\//,
          /^\/oauth2\//,
          /^\/login\//,
          /^\/actuator\//,
          /^\/(privacidad|terminos|cookies)(\.html)?$/,
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': toBackend,
      '/oauth2': toBackend,
      '/login/oauth2': toBackend,
    },
  },
})

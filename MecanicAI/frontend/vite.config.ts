import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// En desarrollo, Vite reenvía la API y el login de Google al backend de Spring Boot,
// así el navegador ve un único dominio (necesario para las cookies de sesión).
const backend = process.env.BACKEND_URL ?? 'http://localhost:8080'

export default defineConfig({
  plugins: [
    react(),
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
        navigateFallback: '/index.html',
        // Nunca servir la app desde caché en rutas del backend (API, login con Google)
        navigateFallbackDenylist: [/^\/api\//, /^\/oauth2\//, /^\/login\//, /^\/actuator\//],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': backend,
      '/oauth2': backend,
      '/login/oauth2': backend,
    },
  },
})

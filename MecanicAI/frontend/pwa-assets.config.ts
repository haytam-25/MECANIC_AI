import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Genera los iconos de la app (favicon, PWA, iPhone) a partir de public/logo.svg:
//   npm run generate-pwa-assets
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#1a1d21' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#1a1d21' } },
  },
  images: ['public/logo.svg'],
})

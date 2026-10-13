import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Tipografías auto-alojadas (sin peticiones a Google Fonts): Barlow, inspirada en rótulos de carretera
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow-condensed/600.css'
import '@fontsource/barlow-condensed/700.css'
// Las de la cesta (letra a mano, rotulador y ticket): solo el alfabeto latino, que es el que usa el español
import '@fontsource/caveat/latin-600.css'
import '@fontsource/caveat/latin-700.css'
import '@fontsource/courier-prime/latin-400.css'
import '@fontsource/courier-prime/latin-700.css'
import '@fontsource/permanent-marker/latin-400.css'

import './styles/tokens.css'
import './styles/global.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

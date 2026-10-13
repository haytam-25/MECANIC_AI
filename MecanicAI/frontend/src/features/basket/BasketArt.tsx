import type { ReactNode } from 'react'

import type { BasketItem } from '../../api/types.ts'

/**
 * Dibujo de la cesta en dos capas del mismo tamaño: el fondo (asa, interior y lo que asoma) y el frente (la pared
 * delantera). Entre las dos pasa el papel que cae dentro, y por eso se ve entrar en la cesta.
 */
const VIEW_BOX = '0 0 320 250'

/** Boca de la cesta: una elipse vista en perspectiva. */
const RIM_BACK = 'M28 96 A132 20 0 0 1 292 96'
const RIM_FRONT = 'M28 96 A132 20 0 0 0 292 96'
const BODY = `${RIM_FRONT} L268 222 Q266 236 252 236 L68 236 Q54 236 52 222 Z`

/** Ranuras de la pared delantera: se juntan hacia abajo, como la cesta. */
const SLOT_ROWS = [136, 168, 200]
const SLOTS_PER_ROW = 9

function slots(): { x: number; y: number }[] {
  return SLOT_ROWS.flatMap((y) => {
    const narrowing = ((y - 96) / (222 - 96)) * 24
    const left = 28 + narrowing + 24
    const right = 292 - narrowing - 24
    return Array.from({ length: SLOTS_PER_ROW }, (_, i) => ({ x: left + ((right - left) * i) / (SLOTS_PER_ROW - 1), y }))
  })
}

/** Lo que asoma por la boca de la cesta: el dibujo de cada artículo sale de su id, así no cambia al añadir otros. */
const PRODUCTS: ReactNode[] = [
  // Garrafa de aceite
  <>
    <rect x="-18" y="-64" width="36" height="64" rx="7" fill="#2f6fd6" />
    <rect x="6" y="-56" width="7" height="16" rx="3.5" fill="#1c4a9c" />
    <rect x="-8" y="-75" width="16" height="13" rx="3" fill="#15171a" />
    <rect x="-13" y="-44" width="20" height="20" rx="2" fill="#ffd23f" />
  </>,
  // Caja de cartón
  <>
    <rect x="-24" y="-52" width="48" height="52" rx="2" fill="#c69a5c" />
    <rect x="-5" y="-52" width="10" height="52" fill="#e8cf9a" />
    <path d="M-24 -40h48" stroke="#a37a42" strokeWidth="2" />
  </>,
  // Bote de spray
  <>
    <rect x="-12" y="-58" width="24" height="58" rx="4" fill="#e33d3d" />
    <rect x="-12" y="-40" width="24" height="12" fill="#f4f4f4" />
    <rect x="-9" y="-65" width="18" height="9" rx="3" fill="#c9ced4" />
    <rect x="-3.5" y="-72" width="7" height="8" rx="1.5" fill="#f4f4f4" />
  </>,
  // Filtro de aceite
  <>
    <rect x="-17" y="-48" width="34" height="48" rx="5" fill="#eef1f4" />
    <path d="M-9 -36v36M0 -36v36M9 -36v36" stroke="#b9c1c9" strokeWidth="2.5" />
    <rect x="-17" y="-48" width="34" height="11" rx="4" fill="#232a33" />
  </>,
  // Neumático
  <>
    <circle cy="-22" r="30" fill="#17191c" stroke="#30353b" strokeWidth="5" />
    <circle cy="-22" r="14" fill="#b9c1c9" />
    <circle cy="-22" r="5" fill="#4a525a" />
  </>,
  // Llave de estrella
  <>
    <rect x="-4.5" y="-66" width="9" height="66" rx="3" fill="#c7ced5" />
    <path d="M-1.5 -62v56" stroke="#eef1f4" strokeWidth="1.5" />
    <circle cy="-76" r="10" fill="none" stroke="#c7ced5" strokeWidth="6.5" />
  </>,
  // Caja de bombillas
  <>
    <rect x="-14" y="-40" width="28" height="40" rx="3" fill="#3fb97c" />
    <rect x="-14" y="-30" width="28" height="9" fill="#f4f4f4" />
    <circle cy="-10" r="4" fill="#ffd23f" />
  </>,
]

/** Sitios de la boca de la cesta, del centro hacia los lados. */
const SPOTS = [
  { x: 160, y: 122, tilt: 0 },
  { x: 108, y: 120, tilt: -8 },
  { x: 212, y: 120, tilt: 7 },
  { x: 82, y: 116, tilt: -12 },
  { x: 238, y: 116, tilt: 11 },
  { x: 134, y: 123, tilt: 5 },
  { x: 187, y: 123, tilt: -5 },
]

function hash(id: string): number {
  let value = 0
  for (const char of id) value = (value * 31 + char.charCodeAt(0)) >>> 0
  return value
}

/** Un dibujo por artículo a la vista, sin repetir el del que tiene al lado. */
function productsOf(items: BasketItem[]): ReactNode[] {
  const picked: number[] = []
  for (const item of items.slice(0, SPOTS.length)) {
    let index = hash(item.id) % PRODUCTS.length
    if (index === picked.at(-1)) index = (index + 1) % PRODUCTS.length
    picked.push(index)
  }
  return picked.map((index) => PRODUCTS[index])
}

/** Capa del fondo: sombra, asa, interior y los artículos que asoman (como mucho, los que caben a la vista). */
export function BasketBack({ items }: { items: BasketItem[] }) {
  const products = productsOf(items)
  return (
    <svg className="basket__svg basket__back" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cesta-acero" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a848e" />
          <stop offset="0.45" stopColor="#e6eaed" />
          <stop offset="1" stopColor="#7a848e" />
        </linearGradient>
        <linearGradient id="cesta-interior" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7c3206" />
          <stop offset="1" stopColor="#2a1002" />
        </linearGradient>
        <radialGradient id="cesta-sombra">
          <stop offset="0" stopColor="rgba(0,0,0,0.6)" />
          <stop offset="1" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
      </defs>
      <ellipse cx="160" cy="238" rx="132" ry="10" fill="url(#cesta-sombra)" />
      <path d="M34 96 C34 -14 286 -14 286 96" fill="none" stroke="url(#cesta-acero)" strokeWidth="9" strokeLinecap="round" />
      <path d="M101.6 21.9 Q160 5.1 218.4 21.9" fill="none" stroke="#15171a" strokeWidth="16" strokeLinecap="round" />
      <path d="M114 18.6 Q160 6.4 206 18.6" fill="none" stroke="#343a41" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 7" />
      <ellipse cx="160" cy="96" rx="132" ry="20" fill="url(#cesta-interior)" />
      <path d={RIM_BACK} fill="none" stroke="#b94c06" strokeWidth="8" strokeLinecap="round" />
      {items.slice(0, SPOTS.length).map((item, i) => (
        <g
          key={item.id}
          className="basket__product"
          style={{ transform: `translate(${SPOTS[i].x}px, ${SPOTS[i].y}px) rotate(${SPOTS[i].tilt}deg) scale(1.15)` }}
        >
          <g className="basket__product-in" style={{ animationDelay: `${i * 55}ms` }}>
            {products[i]}
          </g>
        </g>
      ))}
    </svg>
  )
}

/** Capa del frente: la pared delantera con sus ranuras, el borde y los enganches del asa. */
export function BasketFront() {
  return (
    <svg className="basket__svg basket__front" viewBox={VIEW_BOX} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cesta-frente" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#d2570a" />
          <stop offset="0.3" stopColor="#ff8f38" />
          <stop offset="0.62" stopColor="#ff7a1a" />
          <stop offset="1" stopColor="#bd4b06" />
        </linearGradient>
        <linearGradient id="cesta-fondo" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="rgba(0,0,0,0)" />
          <stop offset="1" stopColor="rgba(60,20,0,0.5)" />
        </linearGradient>
        <radialGradient id="cesta-tuerca" cx="0.4" cy="0.35">
          <stop offset="0" stopColor="#f2f4f6" />
          <stop offset="1" stopColor="#6d7680" />
        </radialGradient>
        <clipPath id="cesta-cuerpo">
          <path d={BODY} />
        </clipPath>
      </defs>
      <path d={BODY} fill="url(#cesta-frente)" />
      <path d={BODY} fill="url(#cesta-fondo)" />
      {slots().map(({ x, y }) => (
        <rect key={`${x}-${y}`} x={x - 4.5} y={y - 11} width="9" height="22" rx="4.5" fill="#3a1602" opacity="0.82" />
      ))}
      <path d="M53 222 Q54 236 68 236 L252 236 Q266 236 267 222 Z" fill="rgba(70,24,0,0.45)" />
      <g clipPath="url(#cesta-cuerpo)">
        <rect className="basket__shine" x="-90" y="70" width="44" height="180" fill="rgba(255,255,255,0.2)" />
      </g>
      <path d={RIM_FRONT} fill="none" stroke="#ffa55c" strokeWidth="10" strokeLinecap="round" />
      <path d="M36 95 A126 17 0 0 0 284 95" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" />
      {[34, 286].map((x) => (
        <g key={x}>
          <circle cx={x} cy="98" r="8" fill="url(#cesta-tuerca)" stroke="#2a2f35" strokeWidth="1.5" />
          <circle cx={x} cy="98" r="2.5" fill="#2a2f35" />
        </g>
      ))}
    </svg>
  )
}

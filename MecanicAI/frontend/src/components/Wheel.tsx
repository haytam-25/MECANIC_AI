import { useId } from 'react'

interface WheelProps {
  size?: number
  spinning?: boolean
  className?: string
  title?: string
}

const SPOKES = [0, 72, 144, 216, 288]

/**
 * Rueda de la marca: neumático con dibujo, llanta de 5 radios y buje naranja.
 * Con `spinning` sirve de indicador de carga.
 */
export function Wheel({ size = 32, spinning = false, className = '', title }: WheelProps) {
  const id = useId()
  const chrome = `${id}-chrome`
  return (
    <svg
      className={`wheel ${spinning ? 'wheel--spinning' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id={chrome} x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#f6f8fa" />
          <stop offset="0.42" stopColor="#b4bcc4" />
          <stop offset="0.52" stopColor="#6a737c" />
          <stop offset="0.72" stopColor="#a1aab3" />
          <stop offset="1" stopColor="#e4e8ec" />
        </linearGradient>
      </defs>
      {/* Neumático */}
      <circle cx="32" cy="32" r="31" fill="#121417" />
      <circle cx="32" cy="32" r="28.2" fill="none" stroke="#2c3238" strokeWidth="4.6" strokeDasharray="5.2 3.66" />
      <circle cx="32" cy="32" r="24.6" fill="#0b0d0f" />
      {/* Llanta */}
      <circle cx="32" cy="32" r="22.4" fill={`url(#${chrome})`} />
      <circle cx="32" cy="32" r="19.2" fill="#1b1f24" />
      <g fill={`url(#${chrome})`}>
        {SPOKES.map((angle) => (
          <path key={angle} d="M28 13.6h8l-2 13h-4z" transform={`rotate(${angle} 32 32)`} />
        ))}
      </g>
      {/* Buje y tuercas */}
      <circle cx="32" cy="32" r="7.4" fill={`url(#${chrome})`} />
      {SPOKES.map((angle) => (
        <circle key={angle} cx="32" cy="27.2" r="1.05" fill="#15181c" transform={`rotate(${angle + 36} 32 32)`} />
      ))}
      <circle cx="32" cy="32" r="3.2" fill="#ff7a1a" />
    </svg>
  )
}

/** Logotipo completo: rueda + "MecanicAI". */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="logo">
      <Wheel size={size} />
      <span className="logo__text">
        Mecanic<span className="logo__ai">AI</span>
      </span>
    </span>
  )
}

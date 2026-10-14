import type { CSSProperties, ReactNode } from 'react'

interface UsageMeterProps {
  label: string
  used: number
  max: number
  /** Explicación bajo la barra (qué pasa al llegar al máximo, invitados…). */
  note?: ReactNode
  /** Si llenarlo bloquea (amarillo al acercarse, rojo al llegar) o solo hace sitio borrando lo más antiguo. */
  blocking?: boolean
}

/** Barra de cuánto se ha usado de un límite: consultas guardadas, reparaciones del diario… */
export function UsageMeter({ label, used, max, note, blocking = false }: UsageMeterProps) {
  const fill = max > 0 ? Math.min(used / max, 1) : 0
  const tone = !blocking ? '' : fill >= 1 ? 'usage--full' : fill >= 0.8 ? 'usage--warn' : ''
  return (
    <div className={`usage ${tone}`}>
      <div className="usage__head">
        <span>{label}</span>
        <span className="usage__count">
          {used} <span>/ {max}</span>
        </span>
      </div>
      <div
        className="usage__bar"
        style={{ '--fill': fill } as CSSProperties}
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={used}
      />
      {note && <p className="usage__note">{note}</p>}
    </div>
  )
}

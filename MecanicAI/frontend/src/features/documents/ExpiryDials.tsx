import type { CSSProperties } from 'react'

import type { DocumentSection } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { daysUntil, expiryStatus, KIND_INFO } from './documents.ts'

const RADIUS = 30
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/** Cuadro de instrumentos con los días que les quedan a la ITV y al seguro (el aro se llena con un año). */
export function ExpiryDials({ sections, vehicleId }: { sections: DocumentSection[]; vehicleId: string }) {
  return (
    <section className="plate doc-dials" aria-label="Días hasta que caduquen la ITV y el seguro">
      {(['INSPECTION', 'INSURANCE'] as const).map((kind, i) => (
        <Dial
          key={kind}
          kind={kind}
          index={i}
          section={sections.find((s) => s.vehicleId === vehicleId && s.kind === kind) ?? null}
        />
      ))}
    </section>
  )
}

function Dial({ kind, section, index }: { kind: 'INSPECTION' | 'INSURANCE'; section: DocumentSection | null; index: number }) {
  const info = KIND_INFO[kind]
  const iso = section?.expiresOn ?? null
  const days = iso ? daysUntil(iso) : null
  const status = iso ? expiryStatus(iso) : 'none'
  const fraction = days === null ? 0 : Math.max(0, Math.min(1, days / 365))
  const style = {
    '--i': index,
    '--dash': CIRCUMFERENCE,
    '--offset': CIRCUMFERENCE * (1 - fraction),
  } as CSSProperties

  return (
    <div className={`doc-dial doc-dial--${status}`} style={style}>
      <span className="doc-dial__gauge">
        <svg viewBox="0 0 72 72" aria-hidden="true">
          <circle className="doc-dial__track" cx="36" cy="36" r={RADIUS} />
          {days !== null && days >= 0 && <circle className="doc-dial__value" cx="36" cy="36" r={RADIUS} />}
        </svg>
        <span className="doc-dial__center">
          <strong>{days === null ? '—' : days < 0 ? '!' : days}</strong>
          <span>{days === null ? 'sin fecha' : days < 0 ? (info.verb === 'vence' ? 'vencido' : 'caducada') : days === 1 ? 'día' : 'días'}</span>
        </span>
      </span>
      <span className="doc-dial__label">
        {info.title}
        {section?.reminder && <Icon name="bell" size={13} />}
      </span>
    </div>
  )
}

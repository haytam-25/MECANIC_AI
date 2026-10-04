import type { CSSProperties } from 'react'

import type { MaintenancePlan } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { diagnose, formatKm, formatMonths, monthsBetween, parseKm, type ItemResult, type Status } from './health.ts'

interface ReportViewProps {
  plan: MaintenancePlan
  results: ItemResult[]
  currentKm: string
  savedAt: string
  now: Date
}

const GROUPS: { status: Status; label: string }[] = [
  { status: 'urgent', label: 'Cambiar ya' },
  { status: 'soon', label: 'Pronto' },
  { status: 'unknown', label: 'Sin datos' },
  { status: 'ok', label: 'Al día' },
  { status: 'info', label: 'Sin cambio programado' },
]

const BAR_ORDER: Status[] = ['urgent', 'soon', 'ok', 'unknown']

const BADGES: Record<Status, string> = {
  urgent: 'Urgente',
  soon: 'Pronto',
  ok: 'Bien',
  unknown: 'Sin datos',
  info: 'Info',
}

/** Informe con un semáforo por elemento: rojo (toca cambiar), ámbar (pronto), verde (al día) y gris (sin datos). */
export function ReportView({ plan, results, currentKm, savedAt, now }: ReportViewProps) {
  const diagnosis = diagnose(results)
  const km = parseKm(currentKm)
  const rated = BAR_ORDER.reduce((sum, status) => sum + diagnosis.counts[status], 0)
  const date = new Date(savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
  const elapsed = monthsBetween(new Date(savedAt), now)

  return (
    <div className="report">
      <section className={`plate diagnosis diagnosis--${diagnosis.tone}`} aria-labelledby="diagnosis-title">
        <div className="diagnosis__head">
          <span className="diagnosis__icon">
            <Icon name="pulse" size={26} />
          </span>
          <div>
            <p className="eyebrow">Diagnóstico</p>
            <h2 className="diagnosis__title" id="diagnosis-title">
              {diagnosis.title}
            </h2>
          </div>
        </div>
        <p className="diagnosis__text">{diagnosis.text}</p>

        {rated > 0 && (
          <div className="health-bar" aria-hidden="true">
            {BAR_ORDER.map((status) =>
              diagnosis.counts[status] > 0 ? (
                <span
                  key={status}
                  className={`health-bar__part health-bar__part--${status}`}
                  style={{ flexGrow: diagnosis.counts[status] }}
                />
              ) : null,
            )}
          </div>
        )}
        <ul className="health-legend">
          {BAR_ORDER.map((status) => (
            <li key={status} className={`health-legend__item tone--${status}`}>
              <span className="health-dot" /> {diagnosis.counts[status]} {GROUPS.find((g) => g.status === status)?.label.toLowerCase()}
            </li>
          ))}
        </ul>
        <p className="small muted">
          Datos del {date}
          {km !== null ? `, con ${formatKm(km)}` : ''}.
          {elapsed >= 2 && ` Han pasado ${formatMonths(elapsed)}: actualiza los kilómetros para afinar el informe.`}
        </p>
      </section>

      {plan.timingNote && plan.timing !== 'DESCONOCIDA' && plan.timing !== 'NINGUNA' && (
        <div className="notice">
          <Icon name="wrench" size={20} />
          <span>{plan.timingNote}</span>
        </div>
      )}

      {GROUPS.map(({ status, label }) => {
        const items = results.filter((r) => r.status === status)
        if (items.length === 0) return null
        return (
          <section key={status} className="report-group">
            <h2 className={`section-label report-group__label tone--${status}`}>
              <span className="health-dot" /> {label}
            </h2>
            <ul className="health-list">
              {items.map((result) => (
                <HealthItem key={result.item.id} result={result} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function HealthItem({ result }: { result: ItemResult }) {
  const { item, name, status, ratio, message, sinceNew } = result
  const fill = ratio === null ? null : Math.min(ratio, 1)
  return (
    <li className={`health-item tone--${status}`}>
      <div className="health-item__head">
        <h3 className="health-item__name">{name}</h3>
        <span className="health-badge">{status === 'urgent' && item.minor ? 'Toca' : BADGES[status]}</span>
      </div>
      <p className="health-item__message">{message}</p>
      {fill !== null && (
        <div
          className="health-meter"
          role="meter"
          aria-label={`Desgaste de ${name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fill * 100)}
          style={{ '--fill': fill } as CSSProperties}
        />
      )}
      {sinceNew && <p className="small muted">Calculado desde que el coche era nuevo.</p>}
      {status === 'urgent' && item.critical && (
        <p className="health-item__warning">
          <Icon name="alert" size={16} />
          {item.id === 'DISTRIBUCION'
            ? 'Si la correa se rompe puede destrozar el motor: no lo dejes para más adelante.'
            : 'Afecta a la seguridad: no lo dejes para más adelante.'}
        </p>
      )}
      {item.note && (
        <p className="health-item__note">
          <Icon name="wrench" size={15} /> {item.note}
        </p>
      )}
    </li>
  )
}

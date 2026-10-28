import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { countGuestReport, fetchMaintenancePlan, saveReport } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { MaintenancePlan, ReportInput, SavedReport, VehicleSpec } from '../../api/types.ts'
import { Hubcap } from '../../components/Hubcap.tsx'
import { Icon } from '../../components/Icon.tsx'
import { Wheel } from '../../components/Wheel.tsx'
import { useSession } from '../../context/session.ts'
import { useToast } from '../../context/toast.ts'
import { brandAbbr, displayName, engineLabel } from '../../lib/vehicle.ts'
import { chatPath } from '../garage/paths.ts'
import { chatQuestion, evaluate } from './health.ts'
import { ReportForm } from './ReportForm.tsx'
import { GuestReportHint, ReportLimitCard, SaveReportCard } from './ReportNotices.tsx'
import { ReportView } from './ReportView.tsx'
import './report.css'

interface VehicleReportProps {
  vehicle: VehicleSpec
  /** Coche del garaje. Con cuenta su informe se guarda; como invitado, no. */
  vehicleId: string
  /** Último informe guardado de este coche (solo con cuenta). */
  saved: SavedReport | null
  onSaved(report: SavedReport): void
  /** Página del coche, a la que se vuelve. */
  backTo: string
}

/** Informe en pantalla: el guardado en la cuenta o, como invitado, el que se acaba de hacer (solo en memoria). */
interface ShownReport {
  input: ReportInput
  savedAt: string
}

const EMPTY_INPUT: ReportInput = { currentKm: '', timing: null, answers: {} }

/** Informe médico de un coche: carga su plan de mantenimiento, pide los datos y muestra el resultado. */
export function VehicleReport({ vehicle, vehicleId, saved, onSaved, backTo }: VehicleReportProps) {
  const { me, setReportUsage } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [plan, setPlan] = useState<MaintenancePlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [shown, setShown] = useState<ShownReport | null>(saved)
  const [editing, setEditing] = useState(saved === null)
  const [submitting, setSubmitting] = useState(false)
  // El informe se calcula con la fecha de cuando se abre la pantalla
  const [now] = useState(() => new Date())
  const topRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    fetchMaintenancePlan(vehicle)
      .then((p) => {
        if (active) setPlan(p)
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof ApiError ? e.message : 'No se pudo preparar el informe.')
      })
    return () => {
      active = false
    }
  }, [vehicle, attempt])

  const results = useMemo(
    () => (plan && shown ? evaluate(plan, shown.input, vehicle, new Date(shown.savedAt), now) : []),
    [plan, shown, vehicle, now],
  )

  if (!me) return null
  const guest = !me.authenticated

  const showTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  // Con cuenta se guarda; como invitado solo se cuenta para el límite semanal
  const submit = async (input: ReportInput) => {
    setSubmitting(true)
    try {
      if (!guest) {
        const { report, usage } = await saveReport(vehicleId, input)
        setReportUsage(usage)
        if (report) {
          setShown(report)
          onSaved(report)
        }
      } else {
        const { usage } = await countGuestReport(vehicleId)
        setReportUsage(usage)
        setShown({ input, savedAt: new Date().toISOString() })
      }
      setEditing(false)
      showTop()
    } catch (e) {
      if (e instanceof ApiError && e.usage) setReportUsage(e.usage)
      toast(e instanceof ApiError ? e.message : 'No se pudo preparar el informe.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Abre una consulta nueva con la pregunta ya escrita
  const askMechanic = () => {
    const draft = chatQuestion(results, shown?.input.currentKm ?? '')
    navigate(chatPath(vehicleId, 'nuevo'), { state: { draft } })
  }

  const engine = engineLabel(vehicle)
  const fallback = plan && plan.source !== 'ai' && plan.source !== 'cache'
  // Solo cuenta el primer informe de cada coche: actualizar uno que ya tiene informe siempre se puede
  const updating = shown !== null
  const blocked = !updating && me.reports.remaining <= 0

  return (
    <div className="page" ref={topRef}>
      <header className="page-head">
        <p className="eyebrow">Informe médico</p>
        <h1 className="page-title">{editing ? 'Historial de mantenimiento' : 'Estado de tu coche'}</h1>
      </header>

      <div className="plate report-car">
        <Hubcap label={brandAbbr(vehicle.brand)} size="sm" />
        <span className="report-car__text">
          <strong>{displayName(vehicle)}</strong>
          {engine && <span>{engine}</span>}
        </span>
        <Link to={backTo} className="btn btn--ghost btn--xs">
          <Icon name="back" size={16} /> Volver
        </Link>
      </div>

      {error ? (
        <div className="notice notice--error">
          <Icon name="alert" size={20} />
          <span>{error}</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setError(null)
              setAttempt((n) => n + 1)
            }}
          >
            Reintentar
          </button>
        </div>
      ) : !plan ? (
        <div className="engine-loading" aria-busy="true">
          <Wheel size={52} spinning />
          <p>
            Consultando el plan de mantenimiento del {vehicle.brand} {vehicle.model}…
          </p>
        </div>
      ) : (
        <>
          {fallback && (
            <div className="notice notice--demo">
              <Icon name="alert" size={20} />
              <span>
                {plan.source === 'demo'
                  ? 'Modo demo: uso los intervalos habituales, no los de tu coche concreto.'
                  : 'No he podido consultar el plan de tu coche concreto: uso los intervalos habituales. Compáralos con el libro de mantenimiento.'}
              </span>
            </div>
          )}

          {editing || !shown ? (
            <>
              {blocked ? (
                <ReportLimitCard guest={guest} features={me.features} usage={me.reports} />
              ) : (
                guest && <GuestReportHint/>
              )}
              {!fallback && (
                <p className="muted small">
                  Intervalos sugeridos por la IA para tu {vehicle.model}. Si el libro de mantenimiento dice otra cosa,
                  manda el libro.
                </p>
              )}
              <ReportForm
                plan={plan}
                initial={shown?.input ?? EMPTY_INPUT}
                quota={updating ? null : me.reports}
                guest={guest}
                submitting={submitting}
                onSubmit={(input) => void submit(input)}
              />
              {shown && (
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  onClick={() => {
                    setEditing(false)
                    showTop()
                  }}
                >
                  Cancelar
                </button>
              )}
            </>
          ) : (
            <>
              <ReportView
                plan={plan}
                results={results}
                currentKm={shown.input.currentKm}
                savedAt={shown.savedAt}
                now={now}
              />
              {guest && <SaveReportCard />}
              <div className="report-actions">
                <button type="button" className="btn btn--primary btn--block" onClick={askMechanic}>
                  <Icon name="chat" size={20} /> Preguntar al mecánico IA
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--block"
                  onClick={() => {
                    setEditing(true)
                    showTop()
                  }}
                >
                  <Icon name="edit" size={20} /> Actualizar datos
                </button>
              </div>
            </>
          )}
          <p className="muted small center">
            {guest
              ? 'Informe orientativo: no sustituye a la revisión de un taller.'
              : 'Informe orientativo, guardado en tu cuenta. No sustituye a la revisión de un taller.'}
          </p>
        </>
      )}
    </div>
  )
}

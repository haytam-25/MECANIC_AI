import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { countGuestReport, fetchMaintenancePlan, saveReport } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { MaintenancePlan, ReportInput, SavedReport, VehicleSpec } from '../../api/types.ts'
import { Hubcap } from '../../components/Hubcap.tsx'
import { Icon } from '../../components/Icon.tsx'
import { Wheel } from '../../components/Wheel.tsx'
import { useSession } from '../../context/session.ts'
import { useToast } from '../../context/toast.ts'
import { loadGuestChat, saveGuestChat } from '../../lib/guestChat.ts'
import { brandAbbr, displayName, engineLabel, toSpec, vehicleKey } from '../../lib/vehicle.ts'
import { chatQuestion, evaluate } from './health.ts'
import { ReportForm } from './ReportForm.tsx'
import { GuestReportHint, ReportLimitCard, SaveReportCard } from './ReportNotices.tsx'
import { ReportView } from './ReportView.tsx'
import './report.css'

interface VehicleReportProps {
  vehicle: VehicleSpec
  /** Coche del garaje (con cuenta): su informe se guarda. null como invitado. */
  vehicleId: string | null
  /** Último informe guardado de este coche (solo con cuenta). */
  saved: SavedReport | null
  onSaved(report: SavedReport): void
  onChangeVehicle(): void
}

/** Informe en pantalla: el guardado en la cuenta o, como invitado, el que se acaba de hacer (solo en memoria). */
interface ShownReport {
  input: ReportInput
  savedAt: string
}

const EMPTY_INPUT: ReportInput = { currentKm: '', timing: null, answers: {} }

/** Informe médico de un coche: carga su plan de mantenimiento, pide los datos y muestra el resultado. */
export function VehicleReport({ vehicle, vehicleId, saved, onSaved, onChangeVehicle }: VehicleReportProps) {
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
      if (vehicleId && !guest) {
        const { report, usage } = await saveReport(vehicleId, input)
        setReportUsage(usage)
        if (report) {
          setShown(report)
          onSaved(report)
        }
      } else {
        const { usage } = await countGuestReport()
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

  // Como invitado solo hay una consulta: no se pisa la de otro coche
  const guestChat = guest ? loadGuestChat() : null
  const canAsk =
    !guestChat || guestChat.messages.length === 0 || vehicleKey(guestChat.vehicle) === vehicleKey(vehicle)

  const askMechanic = () => {
    const draft = chatQuestion(results, shown?.input.currentKm ?? '')
    if (vehicleId && !guest) {
      navigate(`/chat/nuevo?coche=${vehicleId}`, { state: { draft } })
      return
    }
    const messages = guestChat && vehicleKey(guestChat.vehicle) === vehicleKey(vehicle) ? guestChat.messages : []
    saveGuestChat({ vehicle: toSpec(vehicle), messages })
    navigate('/chat/invitado', { state: { draft } })
  }

  const engine = engineLabel(vehicle)
  const fallback = plan && plan.source !== 'ai' && plan.source !== 'cache'
  const blocked = me.reports.remaining <= 0

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
        <button type="button" className="btn btn--ghost btn--xs" onClick={onChangeVehicle}>
          <Icon name="swap" size={16} /> Cambiar
        </button>
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
                guest && <GuestReportHint features={me.features} />
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
                quota={me.reports}
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
              {guest && <SaveReportCard features={me.features} />}
              <div className="report-actions">
                {canAsk && (
                  <button type="button" className="btn btn--primary btn--block" onClick={askMechanic}>
                    <Icon name="chat" size={20} /> Preguntar al mecánico IA
                  </button>
                )}
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
                <button type="button" className="btn btn--ghost btn--block" onClick={onChangeVehicle}>
                  <Icon name="car" size={20} /> Revisar otro coche
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

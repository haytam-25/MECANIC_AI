import { useEffect, useMemo, useState } from 'react'

import { createVehicle, fetchReports } from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import type { SavedReport, Vehicle, VehicleSpec } from '../api/types.ts'
import { Hubcap } from '../components/Hubcap.tsx'
import { Icon } from '../components/Icon.tsx'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { VehicleReport } from '../features/report/VehicleReport.tsx'
import { VehicleWizard } from '../features/wizard/VehicleWizard.tsx'
import { loadGuestChat } from '../lib/guestChat.ts'
import { brandAbbr, engineLabel, vehicleKey } from '../lib/vehicle.ts'
import './pages.css'

/** Coche elegido: con cuenta es uno del garaje (id); como invitado, solo sus datos. */
interface Chosen {
  vehicle: VehicleSpec
  id: string | null
}

/**
 * "Informe médico": el usuario elige su coche, indica cuándo se le hizo cada mantenimiento y ve un informe por
 * colores de lo que toca cambiar. Con cuenta, el último informe de cada coche queda guardado.
 */
export function ReportPage() {
  const { me, vehicles, refreshLists } = useSession()
  const toast = useToast()
  const authenticated = Boolean(me?.authenticated)
  const [chosen, setChosen] = useState<Chosen | null>(null)
  const [adding, setAdding] = useState(false)
  /** Informes guardados (null mientras se cargan; siempre vacío como invitado). */
  const [reports, setReports] = useState<SavedReport[] | null>(null)

  useEffect(() => {
    if (!authenticated) return
    let active = true
    fetchReports()
      .then((list) => {
        if (active) setReports(list)
      })
      .catch(() => {
        if (active) setReports([])
      })
    return () => {
      active = false
    }
  }, [authenticated])

  // Con cuenta: el garaje. Como invitado: el coche de su consulta (si tiene)
  const candidates = useMemo<Chosen[]>(() => {
    if (authenticated) return vehicles.map((v) => ({ vehicle: v, id: v.id }))
    const guestVehicle = loadGuestChat()?.vehicle
    return guestVehicle ? [{ vehicle: guestVehicle, id: null }] : []
  }, [authenticated, vehicles])

  if (!me) return null
  const savedReports = authenticated ? reports : []
  if (savedReports === null) {
    return (
      <div className="center-screen" aria-busy="true">
        <Wheel size={64} spinning title="Cargando" />
      </div>
    )
  }

  if (chosen) {
    return (
      <VehicleReport
        key={chosen.id ?? vehicleKey(chosen.vehicle)}
        vehicle={chosen.vehicle}
        vehicleId={chosen.id}
        saved={savedReports.find((r) => r.vehicleId === chosen.id) ?? null}
        onSaved={(report) =>
          setReports((list) => [report, ...(list ?? []).filter((r) => r.vehicleId !== report.vehicleId)])
        }
        onChangeVehicle={() => {
          setChosen(null)
          setAdding(false)
        }}
      />
    )
  }

  if (adding || candidates.length === 0) {
    const complete = async (spec: VehicleSpec) => {
      if (!me.authenticated) {
        setChosen({ vehicle: spec, id: null })
        return
      }
      // Con cuenta, el coche queda en su garaje (si ya estaba, se reutiliza)
      try {
        const saved: Vehicle = await createVehicle(spec)
        await refreshLists()
        setChosen({ vehicle: saved, id: saved.id })
      } catch (error) {
        toast(error instanceof ApiError ? error.message : 'No se pudo guardar el coche.', 'error')
      }
    }
    return (
      <div className="page">
        <header className="page-head">
          <p className="eyebrow">Informe médico</p>
          <h1 className="page-title">¿Qué coche revisamos?</h1>
          <p className="muted">Elige tu coche y te diré qué mantenimiento le toca según sus kilómetros y su edad.</p>
        </header>
        <VehicleWizard onComplete={complete} savingText="Preparando el informe…" />
        {candidates.length > 0 && (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdding(false)}>
            <Icon name="back" size={20} /> Volver a mis coches
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Informe médico</p>
        <h1 className="page-title">¿Qué coche revisamos?</h1>
        <p className="muted">
          Dime cuándo se cambió el aceite, los filtros, las correas, los frenos… y te haré un chequeo por colores.
        </p>
      </header>

      <ul className="garage">
        {candidates.map((candidate) => {
          const { vehicle: v } = candidate
          const report = savedReports.find((r) => r.vehicleId === candidate.id)
          const engine = engineLabel(v)
          return (
            <li key={candidate.id ?? vehicleKey(v)}>
              <button type="button" className="car-card car-card--button plate" onClick={() => setChosen(candidate)}>
                <Hubcap label={brandAbbr(v.brand)} size="lg" />
                <span className="car-card__text">
                  <span className="car-card__name">
                    {v.brand} {v.model}
                  </span>
                  <span className="car-card__meta">
                    {v.year}
                    {engine ? ` · ${engine}` : ''}
                  </span>
                  {report && (
                    <span className="car-card__meta car-card__report">
                      <Icon name="clock" size={14} /> Informe del{' '}
                      {new Date(report.savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                </span>
                <span className="car-card__cta">
                  <Icon name="pulse" size={18} />
                  {report ? 'Ver' : 'Revisar'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" className="btn btn--ghost btn--block" onClick={() => setAdding(true)}>
        <Icon name="plus" size={20} /> {me.authenticated ? 'Añadir otro coche' : 'Otro coche'}
      </button>
    </div>
  )
}

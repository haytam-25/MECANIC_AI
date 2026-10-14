import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router'

import { fetchMaintenancePlan } from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import type { MaintenancePlan, Repair } from '../api/types.ts'
import { ConfirmRow } from '../components/ConfirmRow.tsx'
import { Icon } from '../components/Icon.tsx'
import { UsageMeter } from '../components/UsageMeter.tsx'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { GuestSaveCard } from '../features/garage/GuestSaveCard.tsx'
import { carPath, repairPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { formatDate, formatPrice, latestByType, nextChange, typeLabel } from '../features/repairs/diary.ts'
import { useRepairs } from '../features/repairs/useRepairs.ts'
import { formatKm } from '../features/report/health.ts'
import '../features/repairs/repairs.css'
import './pages.css'

/** Historial de reparaciones de un coche: lo apuntado (de lo más reciente a lo más antiguo) y el botón para añadir. */
export function RepairsPage() {
  const { me } = useSession()
  const vehicle = useGarageVehicle()
  const { repairs, remove, max } = useRepairs()
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [plan, setPlan] = useState<MaintenancePlan | null>(null)
  const [exporting, setExporting] = useState(false)

  // Con el plan se sabe cuándo toca el próximo cambio de lo que se ha hecho (si falla, simplemente no se muestra)
  useEffect(() => {
    if (!vehicle) return
    let active = true
    fetchMaintenancePlan(vehicle)
      .then((p) => active && setPlan(p))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [vehicle])

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />
  if (repairs === null) {
    return (
      <div className="center-screen" aria-busy="true">
        <Wheel size={64} spinning title="Cargando" />
      </div>
    )
  }

  const list = repairs.filter((r) => r.vehicleId === vehicle.id)
  const total = list.reduce((sum, r) => sum + (r.priceCents ?? 0), 0)
  const full = max > 0 && repairs.length >= max
  const latest = latestByType(list)

  const removeRepair = async (id: string) => {
    try {
      await remove(id)
      toast('Reparación borrada', 'success')
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo borrar la reparación.', 'error')
    } finally {
      setConfirming(null)
    }
  }

  // La librería de PDF solo se descarga al pulsar el botón
  const exportPdf = async () => {
    setExporting(true)
    try {
      const { downloadRepairPdf } = await import('../features/repairs/repairPdf.ts')
      downloadRepairPdf(vehicle, list, plan)
    } catch {
      toast('No se pudo generar el PDF. Inténtalo de nuevo.', 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="page page--enter">
      <header className="page-head">
        <p className="eyebrow">Historial de reparaciones</p>
        <h1 className="page-title">Historial del coche</h1>
      </header>

      <CarPlate
        vehicle={vehicle}
        action={
          <Link to={carPath(vehicle.id)} className="btn btn--ghost btn--xs">
            <Icon name="back" size={16} /> Volver
          </Link>
        }
      />

      {list.length > 0 && (
        <dl className="plate repair-stats">
          <div>
            <dt>
              <Icon name="wrench" size={14} /> Reparaciones
            </dt>
            <dd>{list.length}</dd>
          </div>
          <div>
            <dt>
              <Icon name="euro" size={14} /> Gastado
            </dt>
            <dd>{formatPrice(total)}</dd>
          </div>
          <div>
            <dt>
              <Icon name="gauge" size={14} /> Últimos km
            </dt>
            <dd>{formatKm(Math.max(...list.map((r) => r.km)))}</dd>
          </div>
        </dl>
      )}

      {full ? (
        <p className="notice">
          <Icon name="alert" size={20} />
          <span>
            Tu diario está lleno ({max} reparaciones entre todos tus coches). Borra alguna antigua para apuntar otra.
          </span>
        </p>
      ) : (
        <Link to={repairPath(vehicle.id, 'nueva')} className="btn btn--primary btn--block">
          <Icon name="plus" size={20} /> Apuntar reparación
        </Link>
      )}

      {list.length === 0 ? (
        <section className="plate repair-empty">
          <span className="repair-empty__icon">
            <Icon name="wrench" size={30} />
          </span>
          <p>
            <strong>Aún no hay nada apuntado.</strong>
          </p>
          <p className="muted small">
            Apunta cada vez que pase por el taller: qué se le hizo, con cuántos km, cuánto costó y lo que te dijeron.
            Así tendrás su historial a mano para el próximo mantenimiento o si lo vendes.
          </p>
          <ul className="repair-empty__steps">
            <li>
              <Icon name="calendar" size={16} /> Fecha y km
            </li>
            <li>
              <Icon name="wrench" size={16} /> Qué se hizo
            </li>
            <li>
              <Icon name="euro" size={16} /> Precio y taller
            </li>
          </ul>
        </section>
      ) : (
        <ol className="repair-list stagger">
          {list.map((repair, i) => (
            <li key={repair.id} style={{ '--i': i } as CSSProperties}>
              {confirming === repair.id ? (
                <div className="plate repair-item repair-item--confirm">
                  <ConfirmRow
                    text={`¿Borrar la reparación del ${formatDate(repair.date)}?`}
                    onYes={() => void removeRepair(repair.id)}
                    onNo={() => setConfirming(null)}
                  />
                </div>
              ) : (
                <RepairItem
                  repair={repair}
                  plan={plan}
                  latest={latest}
                  vehicleId={vehicle.id}
                  open={open === repair.id}
                  onToggle={() => setOpen(open === repair.id ? null : repair.id)}
                  onDelete={() => setConfirming(repair.id)}
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {list.length > 0 && (
        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={() => void exportPdf()}
          disabled={exporting}
          aria-busy={exporting}
        >
          {exporting ? <Wheel size={20} spinning /> : <Icon name="file" size={20} />}
          {exporting ? 'Generando PDF…' : 'Descargar historial en PDF'}
        </button>
      )}

      {max > 0 && (
        <UsageMeter
          label="Reparaciones apuntadas"
          used={repairs.length}
          max={max}
          blocking
          note={
            <>
              Puedes apuntar hasta {max} reparaciones entre todos tus coches.
              {!me.authenticated && list.length > 0 && ' Como invitado, se borran al cerrar la página.'}
            </>
          }
        />
      )}

      {!me.authenticated && list.length > 0 && <GuestSaveCard />}
    </div>
  )
}

interface RepairItemProps {
  repair: Repair
  plan: MaintenancePlan | null
  /** Última reparación de cada tipo: solo esa indica el próximo cambio. */
  latest: Map<string, string>
  vehicleId: string
  open: boolean
  onToggle(): void
  onDelete(): void
}

function RepairItem({ repair, plan, latest, vehicleId, open, onToggle, onDelete }: RepairItemProps) {
  const upcoming = repair.types.flatMap((id) => {
    const item = plan?.items.find((i) => i.id === id)
    const when = item && latest.get(id) === repair.id ? nextChange(item, repair) : null
    return when ? [{ id, when }] : []
  })
  const detailsId = `reparacion-${repair.id}`

  return (
    <article className={`plate repair-item ${open ? 'repair-item--open' : ''}`}>
      <button type="button" className="repair-item__head" aria-expanded={open} aria-controls={detailsId} onClick={onToggle}>
        <span className="repair-item__when">
          <strong>{formatDate(repair.date)}</strong>
          <span>
            <Icon name="gauge" size={13} /> {formatKm(repair.km)}
          </span>
        </span>
        <span className="repair-item__types">
          {repair.types.map((id) => (
            <span key={id} className="chip">
              {typeLabel(id, plan)}
            </span>
          ))}
        </span>
        <span className="repair-item__price">{repair.priceCents !== null ? formatPrice(repair.priceCents) : '—'}</span>
        <Icon name="next" size={18} className="repair-item__arrow" />
      </button>

      {open && (
        <div className="repair-item__details" id={detailsId}>
          {repair.workshop && (
            <p className="small repair-item__where">
              <Icon name="pin" size={16} />
              <span>
                <span className="muted">Dónde: </span>
                {repair.workshop}
              </span>
            </p>
          )}
          {repair.notes ? <p className="repair-item__notes">{repair.notes}</p> : <p className="small muted">Sin observaciones.</p>}
          {upcoming.length > 0 && (
            <ul className="repair-item__next">
              {upcoming.map(({ id, when }) => (
                <li key={id} className="small">
                  <Icon name="clock" size={16} /> {typeLabel(id, plan)}: próximo cambio {when}
                </li>
              ))}
            </ul>
          )}
          <div className="repair-item__actions">
            <Link to={repairPath(vehicleId, repair.id)} className="btn btn--ghost btn--xs">
              <Icon name="edit" size={16} /> Corregir
            </Link>
            <button type="button" className="btn btn--ghost btn--xs" onClick={onDelete}>
              <Icon name="trash" size={16} /> Borrar
            </button>
          </div>
        </div>
      )}
    </article>
  )
}

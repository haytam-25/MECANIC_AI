import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import { fetchMaintenancePlan } from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import type { MaintenancePlan, Repair } from '../api/types.ts'
import { Icon } from '../components/Icon.tsx'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { useLogin } from '../context/useLogin.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { repairsPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { isoDate, parsePrice, priceText, type RepairDraft } from '../features/repairs/diary.ts'
import { RepairForm } from '../features/repairs/RepairForm.tsx'
import { useRepairs } from '../features/repairs/useRepairs.ts'
import { parseKm } from '../features/report/health.ts'
import '../features/repairs/repairs.css'
import './pages.css'

const toDraft = (repair: Repair): RepairDraft => ({
  types: repair.types,
  date: repair.date,
  km: String(repair.km),
  price: priceText(repair.priceCents),
  workshop: repair.workshop ?? '',
  notes: repair.notes ?? '',
})

/** /coche/:id/reparaciones/nueva para apuntar una reparación, o …/reparaciones/<id> para corregirla. */
export function RepairFormPage() {
  const { me } = useSession()
  const vehicle = useGarageVehicle()
  const { repairId } = useParams()
  const { repairs, save, max } = useRepairs()
  const navigate = useNavigate()
  const toast = useToast()
  const [plan, setPlan] = useState<MaintenancePlan | null | undefined>(undefined)
  const [submitting, setSubmitting] = useState(false)
  const [today] = useState(() => isoDate(new Date()))

  // El plan del coche dice qué mantenimiento lleva (sin aceite en un eléctrico, bujías solo en gasolina…)
  useEffect(() => {
    if (!vehicle) return
    let active = true
    fetchMaintenancePlan(vehicle)
      .then((p) => active && setPlan(p))
      .catch(() => active && setPlan(null))
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

  const isNew = repairId === 'nueva'
  const editing = isNew ? undefined : repairs.find((r) => r.id === repairId && r.vehicleId === vehicle.id)
  if (!isNew && !editing) return <Navigate to={repairsPath(vehicle.id)} replace />
  const others = repairs.filter((r) => r.vehicleId === vehicle.id && r.id !== editing?.id)
  const full = isNew && max > 0 && repairs.length >= max

  const submit = async (draft: RepairDraft) => {
    setSubmitting(true)
    try {
      const price = parsePrice(draft.price)
      await save(
        {
          vehicleId: vehicle.id,
          date: draft.date,
          km: parseKm(draft.km) ?? 0,
          types: draft.types,
          priceCents: typeof price === 'number' ? price : null,
          workshop: draft.workshop.trim() || null,
          notes: draft.notes.trim() || null,
        },
        editing?.id,
      )
      toast(editing ? 'Reparación corregida' : 'Reparación apuntada en el diario', 'success')
      navigate(repairsPath(vehicle.id), { replace: true })
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo guardar la reparación.', 'error')
      setSubmitting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Diario de reparaciones</p>
        <h1 className="page-title">{editing ? 'Corregir reparación' : 'Nueva reparación'}</h1>
      </header>

      <CarPlate
        vehicle={vehicle}
        action={
          <Link to={repairsPath(vehicle.id)} className="btn btn--ghost btn--xs">
            <Icon name="back" size={16} /> Volver
          </Link>
        }
      />

      {!me.authenticated && <GuestRepairHint />}

      {full ? (
        <section className="plate save-card">
          <h2 className="repair-card__title">Tu diario está lleno</h2>
          <p className="muted">
            Puedes apuntar hasta {max} reparaciones entre todos tus coches. Borra alguna antigua para apuntar otra.
          </p>
        </section>
      ) : (
        <RepairForm
          key={editing?.id ?? 'nueva'}
          vehicle={vehicle}
          plan={plan}
          initial={
            editing
              ? toDraft(editing)
              : { types: [], date: today, km: '', price: '', workshop: '', notes: '' }
          }
          others={others}
          editing={Boolean(editing)}
          submitting={submitting}
          onSubmit={(draft) => void submit(draft)}
        />
      )}
    </div>
  )
}

/** Como invitado el diario no se guarda en el servidor. */
function GuestRepairHint() {
  const { google, loginWithGoogle } = useLogin()
  return (
    <div className="notice notice--demo">
      <Icon name="user" size={20} />
      <span>
        Como invitado tu diario <strong>se borra al cerrar la página</strong>. Inicia sesión con Google para tenerlo
        guardado (si lo haces ahora, lo apuntado pasa a tu cuenta).
      </span>
      {google && (
        <button type="button" className="link-btn" onClick={loginWithGoogle}>
          Iniciar sesión
        </button>
      )}
    </div>
  )
}

import { Link, Navigate } from 'react-router'

import { Icon, type IconName } from '../components/Icon.tsx'
import { useSession } from '../context/session.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { chatsPath, reportPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { useSavedReports } from '../features/report/useSavedReports.ts'
import { relativeDay } from '../lib/format.ts'
import './pages.css'

/** Un coche del garaje: desde aquí se abre el chat con el mecánico (sus consultas) o el informe médico. */
export function VehiclePage() {
  const { me, conversations } = useSession()
  const vehicle = useGarageVehicle()
  const { reports } = useSavedReports()

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />

  const chats = conversations.filter((c) => c.vehicle.id === vehicle.id)
  const report = reports?.find((r) => r.vehicleId === vehicle.id)

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Mi garaje</p>
        <h1 className="page-title">¿Qué necesitas?</h1>
      </header>

      <CarPlate vehicle={vehicle} size="lg" />

      <nav className="hub" aria-label={`Opciones del ${vehicle.brand} ${vehicle.model}`}>
        <HubCard
          to={chatsPath(vehicle.id)}
          icon="chat"
          title="Chat con el mecánico"
          text={
            chats.length === 0
              ? 'Pregunta por averías, ruidos, testigos o mantenimiento'
              : `${chats.length === 1 ? '1 consulta' : `${chats.length} consultas`} · última: ${relativeDay(chats[0].updatedAt)}`
          }
        />
        <HubCard
          to={reportPath(vehicle.id)}
          icon="pulse"
          title="Informe médico"
          text={
            report
              ? `Último informe del ${new Date(report.savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
              : 'Qué mantenimiento le toca según sus kilómetros y su edad'
          }
        />
      </nav>

      
    </div>
  )
}

function HubCard({ to, icon, title, text }: { to: string; icon: IconName; title: string; text: string }) {
  return (
    <Link to={to} className="hub-card plate">
      <span className="hub-card__icon">
        <Icon name={icon} size={28} />
      </span>
      <span className="hub-card__text">
        <span className="hub-card__title">{title}</span>
        <span className="hub-card__meta">{text}</span>
      </span>
      <Icon name="next" size={22} className="hub-card__arrow" />
    </Link>
  )
}

import { Link, Navigate } from 'react-router'

import { Icon, type IconName } from '../components/Icon.tsx'
import { useSession } from '../context/session.ts'
import { useBasket } from '../features/basket/useBasket.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { countFiles, KIND_INFO, countdown, nextExpiry } from '../features/documents/documents.ts'
import { useDocuments } from '../features/documents/useDocuments.ts'
import { basketPath, chatsPath, documentsPath, repairsPath, reportPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { formatDate } from '../features/repairs/diary.ts'
import { useRepairs } from '../features/repairs/useRepairs.ts'
import { useSavedReports } from '../features/report/useSavedReports.ts'
import { relativeDay } from '../lib/format.ts'
import './pages.css'

/**
 * Un coche del garaje: desde aquí se abre el chat con el mecánico (sus consultas), el informe médico, el diario de
 * reparaciones, la cesta de la compra o la documentación.
 */
export function VehiclePage() {
  const { me, conversations } = useSession()
  const vehicle = useGarageVehicle()
  const { reports } = useSavedReports()
  const { repairs } = useRepairs()
  const { items } = useBasket()
  const { sections } = useDocuments()

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />

  const chats = conversations.filter((c) => c.vehicle.id === vehicle.id)
  const report = reports?.find((r) => r.vehicleId === vehicle.id)
  const carRepairs = repairs?.filter((r) => r.vehicleId === vehicle.id) ?? []
  const inBasket = items?.filter((i) => i.vehicleId === vehicle.id).length ?? 0
  const docFiles = sections ? countFiles(sections, vehicle.id) : 0
  const expiring = sections ? nextExpiry(sections, vehicle.id) : null

  return (
    <div className="page page--enter">
      <header className="page-head">
        <p className="eyebrow">Mi garaje</p>
        <h1 className="page-title">¿Qué necesitas?</h1>
      </header>

      <CarPlate vehicle={vehicle} size="lg" />

      <nav className="hub" aria-label={`Opciones del ${vehicle.brand} ${vehicle.model}`}>
        <HubCard
          to={chatsPath(vehicle.id)}
          icon="chat"
          tone="chat"
          count={chats.length}
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
          tone="report"
          title="Informe médico"
          text={
            report
              ? `Último informe del ${new Date(report.savedAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
              : 'Qué mantenimiento le toca según sus kilómetros y su edad'
          }
        />
        <HubCard
          to={repairsPath(vehicle.id)}
          icon="wrench"
          tone="repairs"
          count={carRepairs.length}
          title="Historial de reparaciones"
          text={
            carRepairs.length === 0
              ? 'Apunta lo que le hace el taller: km, precio y observaciones'
              : `${carRepairs.length === 1 ? '1 reparación' : `${carRepairs.length} reparaciones`} · última: ${formatDate(carRepairs[0].date)}`
          }
        />
        <HubCard
          to={basketPath(vehicle.id)}
          icon="basket"
          tone="basket"
          count={inBasket}
          title="Cesta"
          text={
            inBasket === 0
              ? 'Apunta lo que tienes que comprarle: recambios, aceite, herramientas…'
              : `${inBasket === 1 ? '1 artículo' : `${inBasket} artículos`} por comprar`
          }
        />
        <HubCard
          to={documentsPath(vehicle.id)}
          icon="folder"
          tone="docs"
          count={docFiles}
          title="Documentación"
          text={documentsSummary(docFiles, expiring)}
        />
      </nav>
    </div>
  )
}

/** "2 documentos · la ITV caduca en 45 días", o qué se puede guardar si aún no hay nada. */
function documentsSummary(files: number, expiring: ReturnType<typeof nextExpiry>): string {
  const parts: string[] = []
  if (files > 0) parts.push(files === 1 ? '1 documento' : `${files} documentos`)
  if (expiring?.expiresOn && expiring.kind !== 'CUSTOM') {
    const info = KIND_INFO[expiring.kind]
    parts.push(`${info.title}: ${countdown(expiring.expiresOn, info.verb)}`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Permiso de circulación, ITV y seguro, siempre a mano'
}

interface HubCardProps {
  to: string
  icon: IconName
  /** Color de la sección: cada una tiene el suyo para encontrarla de un vistazo. */
  tone: 'chat' | 'report' | 'repairs' | 'basket' | 'docs'
  /** Cuántas cosas hay dentro (se muestra en el icono si hay alguna). */
  count?: number
  title: string
  text: string
}

function HubCard({ to, icon, tone, count = 0, title, text }: HubCardProps) {
  return (
    <Link to={to} className={`hub-card hub-card--${tone} plate`}>
      <span className="hub-card__icon">
        <Icon name={icon} size={28} />
        {count > 0 && (
          <span className="hub-card__badge" aria-hidden="true">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </span>
      <span className="hub-card__text">
        <span className="hub-card__title">{title}</span>
        <span className="hub-card__meta">{text}</span>
      </span>
      <Icon name="next" size={22} className="hub-card__arrow" />
    </Link>
  )
}

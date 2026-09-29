import { useState } from 'react'
import { Link } from 'react-router'

import { Hubcap } from '../components/Hubcap.tsx'
import { Icon } from '../components/Icon.tsx'
import { LoginOptions } from '../components/LoginOptions.tsx'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useVehicleSetup } from '../features/wizard/useVehicleSetup.ts'
import { VehicleWizard } from '../features/wizard/VehicleWizard.tsx'
import { relativeDay } from '../lib/format.ts'
import { loadGuestChat, saveGuestChat, type GuestChat } from '../lib/guestChat.ts'
import { brandAbbr, displayName, engineLabel } from '../lib/vehicle.ts'
import './pages.css'

/**
 * Inicio: con coches guardados muestra el garaje; si no, directamente el asistente para elegir el coche.
 */
export function HomePage() {
  const { me, vehicles } = useSession()
  const [guestChat, setGuestChat] = useState<GuestChat | null>(() => loadGuestChat())
  const complete = useVehicleSetup()

  if (!me) return null
  if (me.authenticated && vehicles.length > 0) return <Garage />
  if (!me.authenticated && guestChat && guestChat.messages.length > 0) {
    return (
      <GuestResume
        chat={guestChat}
        onDiscard={() => {
          saveGuestChat(null)
          setGuestChat(null)
        }}
      />
    )
  }

  return (
    <div className="page">
      <header className="hero">
        <Wheel size={64} className="hero__wheel" />
        <div>
          <h1 className="hero__title">
            Tu mecánico <span className="accent">con IA</span>
          </h1>
          <p className="hero__text">Elige tu coche y cuéntame qué le pasa: averías, ruidos, testigos o mantenimiento.</p>
        </div>
      </header>
      <VehicleWizard onComplete={complete} />
      {!me.authenticated && (
        <p className="muted small center">
          Gratis: {me.features.guestDailyMessages} consultas al día sin cuenta, {me.features.freeDailyMessages} con tu
          cuenta de Google.
        </p>
      )}
    </div>
  )
}

function Garage() {
  const { vehicles, conversations } = useSession()
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Mi garaje</p>
        <h1 className="page-title">¿Con qué coche te ayudo hoy?</h1>
      </header>

      <ul className="garage">
        {vehicles.map((vehicle) => (
          <li key={vehicle.id}>
            <Link to={`/chat/nuevo?coche=${vehicle.id}`} className="car-card plate">
              <Hubcap label={brandAbbr(vehicle.brand)} size="lg" />
              <span className="car-card__text">
                <span className="car-card__name">
                  {vehicle.brand} {vehicle.model}
                </span>
                <span className="car-card__meta">
                  {vehicle.year}
                  {vehicle.engineLabel ? ` · ${vehicle.engineLabel}` : ''}
                </span>
              </span>
              <span className="car-card__cta">
                <Icon name="chat" size={18} />
                Consultar
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/vehiculo/nuevo" className="btn btn--ghost btn--block">
        <Icon name="plus" size={20} /> Añadir otro coche
      </Link>

      {conversations.length > 0 && (
        <section className="recent">
          <h2 className="section-label">Consultas recientes</h2>
          <ul className="recent__list">
            {conversations.slice(0, 5).map((c) => (
              <li key={c.id}>
                <Link to={`/chat/${c.id}`} className="recent__item">
                  <Icon name="chat" size={18} />
                  <span>
                    <span className="recent__title">{c.title}</span>
                    <span className="recent__meta">
                      {c.vehicle.brand} {c.vehicle.model} · {relativeDay(c.updatedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function GuestResume({ chat, onDiscard }: { chat: GuestChat; onDiscard(): void }) {
  const lastQuestion = chat.messages.findLast((m) => m.role === 'user')
  const engine = engineLabel(chat.vehicle)
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Consulta en curso</p>
        <h1 className="page-title">¿Seguimos con tu {chat.vehicle.model}?</h1>
      </header>
      <Link to="/chat/invitado" className="car-card plate">
        <Hubcap label={brandAbbr(chat.vehicle.brand)} size="lg" />
        <span className="car-card__text">
          <span className="car-card__name">{displayName(chat.vehicle)}</span>
          {engine && <span className="car-card__meta">{engine}</span>}
          {lastQuestion && <span className="car-card__quote">«{lastQuestion.content}»</span>}
        </span>
        <span className="car-card__cta">
          <Icon name="chat" size={18} />
          Seguir
        </span>
      </Link>
      <section className="plate save-card">
        <p>
          <strong>Guarda esta consulta</strong> y tu coche iniciando sesión. Si no, se perderán al cambiar de coche o de
          dispositivo.
        </p>
        <LoginOptions />
      </section>
      <button type="button" className="btn btn--ghost btn--block" onClick={onDiscard}>
        <Icon name="car" size={20} /> Consultar por otro coche
      </button>
    </div>
  )
}

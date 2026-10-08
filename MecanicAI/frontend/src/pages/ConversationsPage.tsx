import { useState } from 'react'
import { Link, Navigate } from 'react-router'

import { ApiError } from '../api/http.ts'
import { ConfirmRow } from '../components/ConfirmRow.tsx'
import { Icon } from '../components/Icon.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { carPath, chatPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { relativeDay } from '../lib/format.ts'
import './pages.css'

/** Chat con el mecánico de un coche: sus consultas anteriores y el botón para empezar una nueva. */
export function ConversationsPage() {
  const { me, conversations, removeConversation } = useSession()
  const vehicle = useGarageVehicle()
  const toast = useToast()
  const [confirming, setConfirming] = useState<string | null>(null)

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />

  const chats = conversations.filter((c) => c.vehicle.id === vehicle.id)

  const remove = async (id: string) => {
    try {
      await removeConversation(id)
      toast('Consulta borrada', 'success')
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo borrar la consulta.', 'error')
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Chat con el mecánico</p>
        <h1 className="page-title">Tus consultas</h1>
      </header>

      <CarPlate
        vehicle={vehicle}
        action={
          <Link to={carPath(vehicle.id)} className="btn btn--ghost btn--xs">
            <Icon name="back" size={16} /> Volver
          </Link>
        }
      />

      <Link to={chatPath(vehicle.id, 'nuevo')} className="btn btn--primary btn--block">
        <Icon name="plus" size={20} /> Nueva consulta
      </Link>

      <section className="recent">
        <h2 className="section-label">Consultas anteriores</h2>
        {chats.length === 0 ? (
          <p className="muted small">Aún no has hecho ninguna consulta sobre este coche.</p>
        ) : (
          <ul className="recent__list">
            {chats.map((c) => (
              <li key={c.id} className="chat-row">
                {confirming === c.id ? (
                  <ConfirmRow text="¿Borrar esta consulta?" onYes={() => void remove(c.id)} onNo={() => setConfirming(null)} />
                ) : (
                  <>
                    <Link to={chatPath(vehicle.id, c.id)} className="recent__item">
                      <Icon name="chat" size={18} />
                      <span>
                        <span className="recent__title">{c.title}</span>
                        <span className="recent__meta">{relativeDay(c.updatedAt)}</span>
                      </span>
                    </Link>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm"
                      aria-label={`Borrar consulta ${c.title}`}
                      onClick={() => setConfirming(c.id)}
                    >
                      <Icon name="trash" size={18} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="muted small">
          {!me.authenticated && chats.length > 0 && 'Como invitado, estas consultas se borran al cerrar la página. '}
          Se guardan tus {me.features.maxConversations} consultas más recientes (de todos tus coches): al empezar una
          más, se borra la más antigua.
        </p>
      </section>
    </div>
  )
}

import { useState, type CSSProperties } from 'react'
import { Link, Navigate } from 'react-router'

import { ApiError } from '../api/http.ts'
import { ConfirmRow } from '../components/ConfirmRow.tsx'
import { Icon } from '../components/Icon.tsx'
import { UsageMeter } from '../components/UsageMeter.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { carPath, chatPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { relativeDay } from '../lib/format.ts'
import './pages.css'

/** Preguntas típicas: abren una consulta nueva con el texto ya escrito, para completarlo y enviarlo. */
const SUGGESTIONS = [
  { label: 'Ruido al frenar', draft: 'Me hace un ruido al frenar, ¿qué puede ser?' },
  { label: 'Testigo encendido', draft: 'Se me ha encendido un testigo en el cuadro: ' },
  { label: 'Cambio de aceite', draft: '¿Cada cuánto le toca el cambio de aceite y qué aceite lleva?' },
  { label: 'Le cuesta arrancar', draft: 'Por las mañanas le cuesta arrancar, ¿qué reviso primero?' },
  { label: 'Vibra el volante', draft: 'Noto vibraciones en el volante al ir rápido, ¿qué puede ser?' },
]

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
    <div className="page page--enter">
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

      <div className="ask">
        <Link to={chatPath(vehicle.id, 'nuevo')} className="btn btn--primary btn--block">
          <Icon name="plus" size={20} /> Nueva consulta
        </Link>
        <div className="ask__ideas">
          <span className="ask__label">
            <Icon name="sparkle" size={14} /> Ideas rápidas
          </span>
          <ul className="ask__chips">
            {SUGGESTIONS.map((idea) => (
              <li key={idea.label}>
                <Link to={chatPath(vehicle.id, 'nuevo')} state={{ draft: idea.draft }} className="chip chip--button">
                  {idea.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <section className="recent">
        <h2 className="section-label">
          Consultas anteriores{chats.length > 0 && <span className="section-label__count">{chats.length}</span>}
        </h2>
        {chats.length === 0 ? (
          <div className="plate chats-empty">
            <span className="chats-empty__bubble" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <p>
              <strong>Aún no has hecho ninguna consulta sobre este coche.</strong>
            </p>
            <p className="muted small">
              Cuéntale al mecánico qué notas: ruidos, testigos, vibraciones… Cuantos más detalles, mejor te ayudará.
            </p>
          </div>
        ) : (
          <ul className="recent__list stagger">
            {chats.map((c, i) => (
              <li key={c.id} className="chat-row" style={{ '--i': i } as CSSProperties}>
                {confirming === c.id ? (
                  <ConfirmRow text="¿Borrar esta consulta?" onYes={() => void remove(c.id)} onNo={() => setConfirming(null)} />
                ) : (
                  <>
                    <Link to={chatPath(vehicle.id, c.id)} className="recent__item">
                      <span className="recent__icon">
                        <Icon name="chat" size={18} />
                      </span>
                      <span className="recent__text">
                        <span className="recent__title">{c.title}</span>
                        <span className="recent__meta">
                          <Icon name="clock" size={13} /> {relativeDay(c.updatedAt)}
                        </span>
                      </span>
                      <Icon name="next" size={18} className="recent__arrow" />
                    </Link>
                    <button
                      type="button"
                      className="icon-btn icon-btn--sm icon-btn--danger"
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
      </section>

      {me.features.maxConversations > 0 && (
        <UsageMeter
          label="Consultas guardadas"
          used={conversations.length}
          max={me.features.maxConversations}
          note={
            <>
              {!me.authenticated && chats.length > 0 && 'Como invitado, estas consultas se borran al cerrar la página. '}
              Se guardan tus {me.features.maxConversations} consultas más recientes (de todos tus coches): al empezar
              una más, se borra la más antigua.
            </>
          }
        />
      )}
    </div>
  )
}

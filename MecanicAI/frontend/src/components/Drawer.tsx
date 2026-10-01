import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { deleteConversation, deleteVehicle } from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { relativeDay } from '../lib/format.ts'
import { useInstallPrompt } from '../lib/useInstallPrompt.ts'
import { brandAbbr } from '../lib/vehicle.ts'
import { Avatar } from './Avatar.tsx'
import { Hubcap } from './Hubcap.tsx'
import { Icon } from './Icon.tsx'
import { LoginOptions } from './LoginOptions.tsx'
import { Logo } from './Wheel.tsx'

interface DrawerProps {
  open: boolean
  onClose(): void
}

type Confirm = { kind: 'conversation' | 'vehicle'; id: string } | { kind: 'account' } | null

/** Menú lateral: historial de consultas, garaje y cuenta (al estilo ChatGPT / Gemini). */
export function Drawer({ open, onClose }: DrawerProps) {
  const { me, conversations, vehicles, refreshLists, logout, removeAccount } = useSession()
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { canInstall, showIosHint, install } = useInstallPrompt()
  const [confirm, setConfirm] = useState<Confirm>(null)

  const user = me?.authenticated ? me.user : null

  const go = (path: string) => {
    onClose()
    navigate(path)
  }

  const run = async (action: () => Promise<unknown>, success?: string) => {
    try {
      await action()
      if (success) toast(success, 'success')
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo completar la acción.', 'error')
    } finally {
      setConfirm(null)
    }
  }

  const removeConversation = (id: string) =>
    run(async () => {
      await deleteConversation(id)
      await refreshLists()
      if (id === conversationId) go('/')
    }, 'Consulta borrada')

  const removeVehicle = (id: string) =>
    run(async () => {
      await deleteVehicle(id)
      await refreshLists()
      go('/')
    }, 'Coche borrado del garaje')

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'drawer-backdrop--open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer ${open ? 'drawer--open' : ''}`} aria-label="Menú" inert={!open}>
        <div className="drawer__head">
          <Logo size={28} />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar menú">
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer__body">
          <button type="button" className="btn btn--primary btn--block" onClick={() => go('/')}>
            <Icon name="plus" size={20} /> Nueva consulta
          </button>

          {user ? (
            <>
              <section className="drawer__section">
                <h2 className="section-label">Consultas</h2>
                {conversations.length === 0 ? (
                  <p className="muted small">Aún no tienes consultas guardadas.</p>
                ) : (
                  <ul className="drawer__list">
                    {conversations.map((c) => (
                      <li key={c.id} className={`drawer__item ${c.id === conversationId ? 'drawer__item--active' : ''}`}>
                        {confirm?.kind === 'conversation' && confirm.id === c.id ? (
                          <ConfirmRow
                            text="¿Borrar esta consulta?"
                            onYes={() => void removeConversation(c.id)}
                            onNo={() => setConfirm(null)}
                          />
                        ) : (
                          <>
                            <Link to={`/chat/${c.id}`} className="drawer__link" onClick={onClose}>
                              <span className="drawer__title">{c.title}</span>
                              <span className="drawer__meta">
                                {c.vehicle.brand} {c.vehicle.model} · {relativeDay(c.updatedAt)}
                              </span>
                            </Link>
                            <button
                              type="button"
                              className="icon-btn icon-btn--sm"
                              aria-label={`Borrar consulta ${c.title}`}
                              onClick={() => setConfirm({ kind: 'conversation', id: c.id })}
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

              <section className="drawer__section">
                <h2 className="section-label">Mi garaje</h2>
                <ul className="drawer__list">
                  {vehicles.map((v) => (
                    <li key={v.id} className="drawer__item">
                      {confirm?.kind === 'vehicle' && confirm.id === v.id ? (
                        <ConfirmRow
                          text="¿Borrar el coche y sus consultas?"
                          onYes={() => void removeVehicle(v.id)}
                          onNo={() => setConfirm(null)}
                        />
                      ) : (
                        <>
                          <button type="button" className="drawer__link drawer__link--car" onClick={() => go(`/chat/nuevo?coche=${v.id}`)}>
                            <Hubcap label={brandAbbr(v.brand)} size="sm" />
                            <span>
                              <span className="drawer__title">{v.displayName}</span>
                              {v.engineLabel && <span className="drawer__meta">{v.engineLabel}</span>}
                            </span>
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn--sm"
                            aria-label={`Borrar ${v.displayName}`}
                            onClick={() => setConfirm({ kind: 'vehicle', id: v.id })}
                          >
                            <Icon name="trash" size={18} />
                          </button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
                <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={() => go('/vehiculo/nuevo')}>
                  <Icon name="car" size={18} /> Añadir coche
                </button>
              </section>
            </>
          ) : (
            <section className="drawer__section guest-card">
              <h2 className="guest-card__title">Guarda tus consultas</h2>
              <p className="muted small">
                Inicia sesión para tener tu historial y tu garaje en cualquier dispositivo y hasta{' '}
                {me?.features.freeDailyMessages} mensajes al día.
              </p>
              <LoginOptions />
            </section>
          )}

          {(canInstall || showIosHint) && (
            <section className="drawer__section install-card">
              <Icon name="install" size={20} />
              {canInstall ? (
                <button type="button" className="link-btn" onClick={() => void install()}>
                  Instalar MecanicAI en el móvil
                </button>
              ) : (
                <p className="small">
                  Instálala: pulsa <strong>Compartir</strong> y luego <strong>Añadir a pantalla de inicio</strong>.
                </p>
              )}
            </section>
          )}
        </div>

        {user && me && (
          <div className="drawer__foot">
            {confirm?.kind === 'account' ? (
              <div className="danger-box">
                <p className="small">Se borrarán tu cuenta, tus coches y todas tus consultas. No se puede deshacer.</p>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => {
                      onClose()
                      void run(removeAccount, 'Cuenta eliminada')
                    }}
                  >
                    Eliminar definitivamente
                  </button>
                  <button type="button" className="btn btn--ghost btn--sm" onClick={() => setConfirm(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="account">
                  <Avatar user={user} size={40} />
                  <div className="account__info">
                    <span className="account__name">{user.name ?? user.email}</span>
                    <span className="drawer__meta">
                      Plan gratis · {me.usage.used}/{me.usage.limit} mensajes hoy
                    </span>
                  </div>
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      onClose()
                      void run(logout)
                    }}
                  >
                    <Icon name="logout" size={18} /> Cerrar sesión
                  </button>
                  <button type="button" className="link-btn link-btn--danger small" onClick={() => setConfirm({ kind: 'account' })}>
                    Eliminar cuenta
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </aside>
    </>
  )
}

function ConfirmRow({ text, onYes, onNo }: { text: string; onYes(): void; onNo(): void }) {
  return (
    <div className="confirm-row">
      <span className="small">{text}</span>
      <button type="button" className="btn btn--danger btn--xs" onClick={onYes}>
        Borrar
      </button>
      <button type="button" className="btn btn--ghost btn--xs" onClick={onNo}>
        No
      </button>
    </div>
  )
}

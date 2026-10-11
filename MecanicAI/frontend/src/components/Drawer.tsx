import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'

import { ApiError } from '../api/http.ts'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { GuestSaveCard } from '../features/garage/GuestSaveCard.tsx'
import { carPath } from '../features/garage/paths.ts'
import { useInstallPrompt } from '../lib/useInstallPrompt.ts'
import { brandAbbr, formatPlate } from '../lib/vehicle.ts'
import { Avatar } from './Avatar.tsx'
import { ConfirmRow } from './ConfirmRow.tsx'
import { Hubcap } from './Hubcap.tsx'
import { Icon } from './Icon.tsx'
import { LegalLinks } from './LegalLinks.tsx'
import { Logo } from './Wheel.tsx'

interface DrawerProps {
  open: boolean
  onClose(): void
}

type Confirm = { kind: 'vehicle'; id: string } | { kind: 'account' } | null

/** Menú lateral: el garaje con los coches del usuario y su cuenta. */
export function Drawer({ open, onClose }: DrawerProps) {
  const { me, vehicles, removeVehicle, logout, removeAccount } = useSession()
  const { vehicleId } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { canInstall, showIosHint, install } = useInstallPrompt()
  const [confirm, setConfirm] = useState<Confirm>(null)

  const user = me?.authenticated ? me.user : null
  const maxVehicles = me?.features.maxVehicles ?? 0
  const full = maxVehicles > 0 && vehicles.length >= maxVehicles

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

  const remove = (id: string) =>
    run(async () => {
      await removeVehicle(id)
      // Si estaba viendo ese coche, vuelve al inicio
      if (id === vehicleId) go('/')
    }, 'Coche borrado del garaje')

  return (
    <>
      <div className={`drawer-backdrop ${open ? 'drawer-backdrop--open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`drawer ${open ? 'drawer--open' : ''}`} aria-label="Mi garaje" inert={!open}>
        <div className="drawer__head">
          <Logo size={28} />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar garaje">
            <Icon name="close" />
          </button>
        </div>

        <div className="drawer__body">
          <section className="drawer__section">
            <h2 className="section-label">
              Mi garaje{maxVehicles > 0 && ` · ${vehicles.length}/${maxVehicles}`}
            </h2>
            {vehicles.length === 0 ? (
              <p className="muted small">Aún no tienes coches. Elige el tuyo para empezar.</p>
            ) : (
              <ul className="drawer__list">
                {vehicles.map((v) => (
                  <li key={v.id} className={`drawer__item ${v.id === vehicleId ? 'drawer__item--active' : ''}`}>
                    {confirm?.kind === 'vehicle' && confirm.id === v.id ? (
                      <ConfirmRow
                        text="¿Borrar el coche y sus consultas?"
                        onYes={() => void remove(v.id)}
                        onNo={() => setConfirm(null)}
                      />
                    ) : (
                      <>
                        <button
                          type="button"
                          className="drawer__link drawer__link--car"
                          aria-current={v.id === vehicleId ? 'page' : undefined}
                          onClick={() => go(carPath(v.id))}
                        >
                          <Hubcap label={brandAbbr(v.brand)} size="sm" />
                          <span>
                            <span className="drawer__title">{v.displayName}</span>
                            {(v.plate || v.engineLabel) && (
                              <span className="drawer__meta">
                                {[v.plate && formatPlate(v.plate), v.engineLabel].filter(Boolean).join(' · ')}
                              </span>
                            )}
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
            )}
            {full ? (
              <p className="muted small">Garaje lleno: borra un coche para añadir otro.</p>
            ) : (
              <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={() => go('/')}>
                <Icon name="plus" size={18} /> Añadir coche
              </button>
            )}
          </section>

          <GuestSaveCard compact />

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

          <LegalLinks className="drawer__legal" />
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

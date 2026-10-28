import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router'

import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { useLogin } from '../context/useLogin.ts'
import { firstName } from '../lib/format.ts'
import { WelcomePage } from '../pages/WelcomePage.tsx'
import { Avatar } from './Avatar.tsx'
import { Drawer } from './Drawer.tsx'
import { Icon } from './Icon.tsx'
import { Logo, Wheel } from './Wheel.tsx'
import './shell.css'

/** Lo que las páginas reciben del marco de la app (useOutletContext). */
export interface ShellContext {
  openGarage(): void
}

export function AppShell() {
  const { me, offline, refreshMe, completeLogin, guestMode } = useSession()
  const location = useLocation()
  const [drawerPath, setDrawerPath] = useState<string | null>(null)
  const drawerOpen = drawerPath === location.pathname
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const toast = useToast()
  const loginHandled = useRef(false)
  const openGarage = () => setDrawerPath(location.pathname)

  // Vuelta del login de Google: /?login=ok o /?login=error
  useEffect(() => {
    const result = searchParams.get('login')
    if (!result || !me || loginHandled.current) return
    loginHandled.current = true
    setSearchParams({}, { replace: true })
    if (result !== 'ok' || !me.authenticated) {
      toast('No se pudo iniciar sesión con Google. Inténtalo de nuevo.', 'error')
      return
    }
    completeLogin()
      .then(({ path, skipped, skippedRepairs, skippedBasket }) => {
        toast(`¡Hola${me.user?.name ? `, ${firstName(me.user.name)}` : ''}! Tus coches, consultas, reparaciones y cesta se guardarán en tu cuenta.`, 'success')
        if (skipped > 0) {
          toast(
            `Tu garaje ya tenía ${me.features.maxVehicles} coches: ${skipped === 1 ? '1 coche' : `${skipped} coches`} del modo invitado no se ${skipped === 1 ? 'ha' : 'han'} guardado.`,
            'error',
          )
        }
        if (skippedRepairs > 0) {
          toast(
            `${skippedRepairs === 1 ? '1 reparación' : `${skippedRepairs} reparaciones`} del modo invitado no se ${skippedRepairs === 1 ? 'ha' : 'han'} podido guardar en tu cuenta (el diario admite ${me.features.maxRepairs} como mucho).`,
            'error',
          )
        }
        if (skippedBasket > 0) {
          toast(
            `${skippedBasket === 1 ? '1 artículo' : `${skippedBasket} artículos`} de la cesta del modo invitado no se ${skippedBasket === 1 ? 'ha' : 'han'} podido guardar en tu cuenta (la cesta admite ${me.features.maxBasketItems} como mucho).`,
            'error',
          )
        }
        if (path) navigate(path, { replace: true })
      })
      .catch(() => toast('No se pudo guardar tu garaje de invitado en la cuenta.', 'error'))
  }, [searchParams, setSearchParams, me, completeLogin, navigate, toast])

  // Portada: sin sesión y sin haber elegido el modo invitado
  if (me && !me.authenticated && !guestMode) return <WelcomePage />

  return (
    <div className="shell">
      <TopBar onMenu={openGarage} />
      <Drawer open={drawerOpen} onClose={() => setDrawerPath(null)} />
      <main className="shell__main">
        {offline && !me ? (
          <div className="center-screen">
            <Wheel size={72} />
            <h1 className="page-title">Sin conexión con el taller</h1>
            <p className="muted">No se puede contactar con el servidor de MecanicAI.</p>
            <button type="button" className="btn btn--primary" onClick={() => void refreshMe()}>
              <Icon name="refresh" size={20} /> Reintentar
            </button>
          </div>
        ) : !me ? (
          <div className="center-screen" aria-busy="true">
            <Wheel size={64} spinning title="Cargando" />
          </div>
        ) : (
          <Outlet context={{ openGarage } satisfies ShellContext} />
        )}
      </main>
    </div>
  )
}

function TopBar({ onMenu }: { onMenu(): void }) {
  const { me } = useSession()
  const { google, loginWithGoogle } = useLogin()
  const user = me?.authenticated ? me.user : null

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button type="button" className="icon-btn" onClick={onMenu} aria-label="Abrir mi garaje">
          <Icon name="menu" />
        </button>
        <Link to="/" className="topbar__brand" aria-label="MecanicAI, inicio">
          <Logo size={30} />
        </Link>
        <div className="topbar__right">
          {user ? (
            <button type="button" className="avatar-btn" onClick={onMenu} aria-label="Tu cuenta">
              <Avatar user={user} />
            </button>
          ) : me && google ? (
            <button type="button" className="btn btn--ghost btn--sm" onClick={loginWithGoogle}>
              Iniciar sesion
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
            </svg>
            </button>
          ) : null}
        </div>
      </div>
      <div className="tread" aria-hidden="true" />
    </header>
  )
}

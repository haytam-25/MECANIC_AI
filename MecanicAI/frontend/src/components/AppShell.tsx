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
      .then((path) => {
        toast(`¡Hola${me.user?.name ? `, ${firstName(me.user.name)}` : ''}! Tus coches y consultas se guardarán en tu cuenta.`, 'success')
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
              Entrar
            </button>
          ) : null}
        </div>
      </div>
      <div className="tread" aria-hidden="true" />
    </header>
  )
}

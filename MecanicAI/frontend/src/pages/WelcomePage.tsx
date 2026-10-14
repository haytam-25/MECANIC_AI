import { useNavigate } from 'react-router'

import { GoogleButton } from '../components/GoogleButton.tsx'
import { Icon } from '../components/Icon.tsx'
import { LegalLinks } from '../components/LegalLinks.tsx'
import { BrandMark } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import './pages.css'

/**
 * Portada: lo primero que ve quien entra sin sesión. Elige entre iniciar sesión con Google o seguir como invitado.
 */
export function WelcomePage() {
  const { me, loginWithGoogle, enterGuestMode } = useSession()
  const navigate = useNavigate()
  if (!me) return null
  const { googleLogin, guestDailyMessages, freeDailyMessages } = me.features

  const enterAsGuest = () => {
    enterGuestMode()
    navigate('/', { replace: true })
  }

  return (
    <div className="welcome">
      <div className="tread" aria-hidden="true" />
      <main className="welcome__main">
        <BrandMark size={112} className="welcome__logo" />
        <h1 className="welcome__title">
          Mecanic<span className="welcome__ai">AI</span>
        </h1>
        <p className="welcome__tagline">Tu asistente personal de mantenimiento y diagnóstico de tu coche</p>

        <div className="welcome__actions plate">
          {googleLogin && <GoogleButton label="Iniciar con Google" onClick={loginWithGoogle} />}
          <button type="button" className="btn btn--ghost btn--block" onClick={enterAsGuest}>
            <Icon name="user" size={20} /> Modo Invitado
          </button>
          <ul className="welcome__plans">
            <li>
              <strong>Invitado:</strong> {guestDailyMessages} preguntas al día
            </li>
            {googleLogin && (
              <li>
                <strong>Con Google:</strong> {freeDailyMessages} preguntas al día y tus coches guardados
              </li>
            )}
          </ul>
        </div>

        <ul className="welcome__features">
          <li>
            <Icon name="car" size={20} /> Elige tu coche: marca, modelo, año y motor
          </li>
          <li>
            <Icon name="chat" size={20} /> Pregunta por averías, ruidos, testigos o mantenimiento
          </li>
          <li>
            <Icon name="pulse" size={20} /> Revisa tu coche como esta de sano.
          </li>
          <li>
            <Icon name="wrench" size={20} /> Guarda tu historial de reparaciones e impremelo en pdf para venta.
          </li>
          <li>
            <Icon name="basket" size={20} /> ¿Se te olvida que tenias que comprar? Apuntalo en la lista de compra.
          </li>
        </ul>
      </main>
      <footer className="welcome__footer">
        <LegalLinks />
      </footer>
    </div>
  )
}

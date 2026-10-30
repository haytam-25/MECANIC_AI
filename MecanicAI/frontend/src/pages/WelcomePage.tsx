import { useId } from 'react'
import { useNavigate } from 'react-router'

import { GoogleButton } from '../components/GoogleButton.tsx'
import { Icon } from '../components/Icon.tsx'
import { LegalLinks } from '../components/LegalLinks.tsx'
import { BrandMark, Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import './pages.css'

/** Coupé naranja de la marca, visto de lado y mirando a la derecha. Las ruedas son la misma `Wheel` del resto de la app. */
function Car() {
  const id = useId()
  const paint = `${id}-paint`
  const glass = `${id}-glass`
  return (
    <div className="car" aria-hidden="true">
      <span className="car__beam" />
      <span className="car__lines" />
      <svg className="car__body" viewBox="0 0 200 70">
        <defs>
          <linearGradient id={paint} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb06e" />
            <stop offset="0.45" stopColor="#ff7a1a" />
            <stop offset="1" stopColor="#c45208" />
          </linearGradient>
          <linearGradient id={glass} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a434c" />
            <stop offset="0.5" stopColor="#14181c" />
            <stop offset="1" stopColor="#262c33" />
          </linearGradient>
        </defs>
        {/* Carrocería con los pasos de rueda */}
        <path
          fill={`url(#${paint})`}
          d="M12 56C7 56 5 53 5 49V40c0-5 3-8 9-9l34-4c12-11 22-16 36-17h32c12 0 20 5 32 15l30 4c12 2 18 7 18 15v7c0 3-2 5-5 5h-16a20 20 0 0 0-40 0H65a20 20 0 0 0-40 0z"
        />
        {/* Ventanillas */}
        <path fill={`url(#${glass})`} d="M56 27c10-9 18-13 30-13h12v13zM103 14h11c10 0 18 4 27 13h-38z" />
        <path fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.2" d="M70 25l10-9M118 25l8-9" />
        {/* Puerta, maneta, faros y bajos */}
        <path fill="none" stroke="rgba(60,22,0,0.45)" strokeWidth="1" d="M100 28v24M64 52h72" />
        <rect x="106" y="32" width="8" height="2" rx="1" fill="rgba(60,22,0,0.55)" />
        <path fill="#fff4dc" d="M184 35l11 3v4l-12-2z" />
        <rect x="5" y="37" width="4" height="7" rx="1" fill="#ff3b3b" />
        <image href="/logo.svg" x="76" y="32" width="15" height="15" />
      </svg>
      <Wheel size={33} className="car__wheel car__wheel--rear" />
      <Wheel size={33} className="car__wheel car__wheel--front" />
    </div>
  )
}

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
        {/* El coche cruza la portada y va dejando el nombre escrito tras de sí */}
        <div className="welcome__drive">
          <h1 className="welcome__title">
            Mecanic<span className="welcome__ai">AI</span>
          </h1>
          <div className="welcome__road" aria-hidden="true" />
          <Car />
        </div>
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

      {/* Más información, bajo la portada: es lo que lee Google y lo que convence a quien llega desde una búsqueda */}
      <section className="welcome__more" aria-labelledby="welcome-more-title">
        <h2 id="welcome-more-title">Mecánico online gratis</h2>
        <p>
          MecanicAI responde a tus dudas de mecánica teniendo en cuenta <strong>tu coche concreto</strong>: marca, modelo,
          año y motorización. Cuéntale qué le pasa con tus palabras (un ruido raro, un testigo encendido, que tira humo o
          que no arranca) y te explica las causas más probables, qué puedes revisar tú y cuándo conviene ir al taller.
        </p>

        <h3>Cómo funciona</h3>
        <ol className="welcome__steps">
          <li>
            <strong>Elige tu coche</strong> entre más de 50 marcas y 900 modelos del mercado español.
          </li>
          <li>
            <strong>Pregunta lo que quieras</strong>, escribiendo o por voz.
          </li>
          <li>
            <strong>Recibe la respuesta al momento</strong>, con los riesgos de seguridad y qué hacer después.
          </li>
        </ol>

        <h3>Qué puedes hacer</h3>
        <ul>
          <li>
            <strong>Diagnóstico de averías:</strong> ruidos al frenar o al girar, vibraciones, tirones, humo, fugas,
            problemas de arranque…
          </li>
          <li>
            <strong>Testigos del cuadro:</strong> qué significa cada luz y si puedes seguir circulando.
          </li>
          <li>
            <strong>Informe médico del coche:</strong> con los kilómetros y cuándo cambiaste cada cosa, te dice qué toca
            cambiar ya (aceite, filtros, correa de distribución, frenos, neumáticos…).
          </li>
          <li>
            <strong>Historial de reparaciones en PDF</strong>, ideal para demostrar el mantenimiento al vender el coche.
          </li>
          <li>
            <strong>Lista de la compra</strong> de recambios y herramientas para cada coche.
          </li>
        </ul>

        <h3>Preguntas frecuentes</h3>
        <details>
          <summary>¿Es gratis?</summary>
          <p>
            Sí. Sin cuenta puedes hacer {guestDailyMessages} preguntas al día
            {googleLogin && <>, y con tu cuenta de Google, {freeDailyMessages} al día y tus coches guardados</>}.
          </p>
        </details>
        <details>
          <summary>¿Sustituye a un taller?</summary>
          <p>
            No. Te da una orientación para entender qué le pasa a tu coche, saber si es urgente y llegar al taller sabiendo
            de qué hablar. Una avería solo se confirma revisando el coche en persona.
          </p>
        </details>
        <details>
          <summary>¿Necesito instalar algo?</summary>
          <p>
            No, funciona en el navegador del móvil o del ordenador. Si quieres, puedes instalarla como una app desde el
            propio navegador.
          </p>
        </details>
        <details>
          <summary>¿Qué hacéis con mis datos?</summary>
          <p>
            Solo guardamos lo necesario para que funcione, sin publicidad ni cookies de seguimiento. Tu nombre, tu correo y
            tu matrícula nunca se envían a la IA. Lo tienes todo en la <a href="/privacidad">política de privacidad</a>.
          </p>
        </details>

        <h3>Guías de mecánica</h3>
        <ul>
          <li>
            <a href="/guias/testigos-del-coche">Testigos del coche: qué significa cada luz del cuadro</a>
          </li>
          <li>
            <a href="/guias/ruidos-del-coche">Ruidos del coche: qué significan y cuándo preocuparse</a>
          </li>
          <li>
            <a href="/guias/mantenimiento-del-coche">Mantenimiento del coche por kilómetros</a>
          </li>
        </ul>
      </section>

      <footer className="welcome__footer">
        <LegalLinks />
      </footer>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { fetchShared } from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import type { SharedConversation } from '../api/types.ts'
import { Hubcap } from '../components/Hubcap.tsx'
import { Logo, Wheel } from '../components/Wheel.tsx'
import { AiMessage, UserMessage } from '../features/chat/ChatView.tsx'
import { brandAbbr, displayName, engineLabel } from '../lib/vehicle.ts'

type Loaded = { token: string; chat: SharedConversation } | { token: string; error: string }

/**
 * Consulta compartida (/compartido/<código>): la lee cualquiera que reciba el enlace, sin cuenta. Solo lectura, y con
 * un botón para preguntar por su propio coche.
 */
export function SharedChatPage() {
  const { token = '' } = useParams()
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    let current = true
    fetchShared(token).then(
      (chat) => current && setLoaded({ token, chat }),
      (error: unknown) =>
        current &&
        setLoaded({
          token,
          error:
            error instanceof ApiError && error.status === 404
              ? 'Este enlace ha caducado o la consulta ya no se comparte.'
              : 'No se pudo abrir la consulta. Inténtalo de nuevo en un momento.',
        }),
    )
    return () => {
      current = false
    }
  }, [token])

  // Las consultas compartidas son privadas de quien tiene el enlace: que Google no las indexe
  // (nginx envía además X-Robots-Tag). Se cambia la etiqueta de index.html, que dice "index, follow"
  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robots) return
    const previous = robots.content
    robots.content = 'noindex, nofollow'
    return () => {
      robots.content = previous
    }
  }, [])

  const shown = loaded?.token === token ? loaded : null
  const chat = shown && 'chat' in shown ? shown.chat : null

  useEffect(() => {
    if (!chat) return
    const previous = document.title
    document.title = `${chat.title} · ${chat.vehicle.brand} ${chat.vehicle.model} · MecanicAI`
    return () => {
      document.title = previous
    }
  }, [chat])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar__inner">
          <a href="/" className="topbar__brand" aria-label="MecanicAI, inicio">
            <Logo size={30} />
          </a>
        </div>
        <div className="tread" aria-hidden="true" />
      </header>
      <main className="shell__main">
        {!shown ? (
          <div className="center-screen" aria-busy="true">
            <Wheel size={56} spinning title="Cargando la consulta" />
          </div>
        ) : chat ? (
          <SharedChat chat={chat} />
        ) : (
          <div className="center-screen">
            <Wheel size={72} />
            <h1 className="page-title">Consulta no disponible</h1>
            <p className="muted">{'error' in shown && shown.error}</p>
            <a href="/" className="btn btn--primary">
              Pregunta al mecánico por tu coche
            </a>
          </div>
        )}
      </main>
    </div>
  )
}

function SharedChat({ chat }: { chat: SharedConversation }) {
  const vehicle = { ...chat.vehicle, plate: null }
  const { brandId, modelId } = chat.vehicle
  // Abre el asistente con el mismo coche ya elegido (ver HomePage)
  const askHref =
    brandId && modelId ? `/?marca=${encodeURIComponent(brandId)}&modelo=${encodeURIComponent(modelId)}` : '/'

  return (
    <div className="shared">
      <div className="vehicle-bar shared__bar">
        <Hubcap label={brandAbbr(vehicle.brand)} size="sm" />
        <div className="vehicle-bar__text">
          <strong>{displayName(vehicle)}</strong>
          <span>{engineLabel(vehicle) ?? 'Motorización sin especificar'}</span>
        </div>
      </div>
      <div className="chat__inner">
        <p className="muted small">
          Consulta compartida con el mecánico con IA de MecanicAI. Es orientativa: no sustituye a un taller.
        </p>
        {chat.messages.map((message, index) =>
          message.role === 'user' ? (
            <UserMessage key={index} text={message.content} />
          ) : (
            <AiMessage key={index} text={message.content} streaming={false} model={vehicle.model} />
          ),
        )}
        <div className="shared__cta">
          <strong>¿Tienes un {vehicle.brand} {vehicle.model} o cualquier otro coche?</strong>
          <span className="muted small">Pregúntale gratis al mecánico con IA: averías, ruidos, testigos, mantenimiento…</span>
          <a href={askHref} className="btn btn--primary">
            Pregunta por tu coche
          </a>
        </div>
      </div>
    </div>
  )
}

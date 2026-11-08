import { memo, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import type { ChatMessage, VehicleSpec } from '../../api/types.ts'
import { Hubcap } from '../../components/Hubcap.tsx'
import { Icon } from '../../components/Icon.tsx'
import { MarkdownText } from '../../components/MarkdownText.tsx'
import { Wheel } from '../../components/Wheel.tsx'
import { brandAbbr, displayName, engineLabel } from '../../lib/vehicle.ts'
import { Composer } from './Composer.tsx'
import './chat.css'

export interface ChatFailure {
  message: string
  onRetry?: () => void
}

interface ChatViewProps {
  vehicle: VehicleSpec
  /** A dónde lleva el botón "Volver" (las consultas del coche). */
  backTo: string
  messages: ChatMessage[]
  /** Texto de la respuesta que está llegando (null si no hay ninguna en curso). */
  streamingText: string | null
  failure: ChatFailure | null
  /** Aviso bajo los mensajes (p. ej. límite diario alcanzado). */
  notice?: ReactNode
  /** Banner sobre los mensajes (p. ej. modo demo). */
  banner?: ReactNode
  footer: ReactNode
  inputDisabled?: boolean
  /** Texto con el que empieza la caja de mensaje (p. ej. la pregunta que prepara el informe médico). */
  initialDraft?: string
  /** Devuelve false si el mensaje no se llegó a enviar (se recupera el texto). */
  onSend(text: string): Promise<boolean>
  onStop(): void
}

const SUGGESTIONS = [
  '¿Qué averías típicas tiene este modelo?',
  '¿Qué aceite usa y qué marca es la mejor?',
  'Hace un ruido raro el coche, ¿qué puede ser?',
  '¿Qué mantenimientos tiene y cada cuánto?',
  'Se me ha encendido un testigo en el cuadro, ¿qué puede ser?',
  'Tengo un código de avería OBD: ',
]

export function ChatView(props: ChatViewProps) {
  const { vehicle, backTo, messages, streamingText, failure, notice, banner, footer, inputDisabled, initialDraft, onSend, onStop } =
    props
  const [draft, setDraft] = useState(initialDraft ?? '')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const stickToBottom = useRef(true)

  // Baja automáticamente mientras llega la respuesta, salvo que el usuario haya subido a leer
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [messages, streamingText, failure, notice])

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120
  }

  const send = async (text: string) => {
    stickToBottom.current = true
    setDraft('')
    const sent = await onSend(text)
    if (!sent) setDraft((current) => current || text)
  }

  const suggest = (text: string) => {
    setDraft(text)
    inputRef.current?.focus()
  }

  const busy = streamingText !== null
  const engine = engineLabel(vehicle)
  // La respuesta en curso va al final de la lista con la clave que tendrá al terminar: así no se vuelve a montar
  // (ni repite la animación de entrada) cuando acaba de escribirse
  const thread: ChatMessage[] = busy ? [...messages, { role: 'assistant', content: streamingText }] : messages

  return (
    <div className="chat">
      <div className="vehicle-bar">
        <Hubcap label={brandAbbr(vehicle.brand)} size="sm" />
        <div className="vehicle-bar__text">
          <strong>{displayName(vehicle)}</strong>
          <span>{engine ?? 'Motorización sin especificar'}</span>
        </div>
        <Link to={backTo} className="btn btn--ghost btn--xs" aria-label="Volver a las consultas de este coche">
          <Icon name="back" size={16} /> Consultas
        </Link>
      </div>

      <div className="chat__scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="chat__inner">
          {banner}
          <article className="msg msg--ai">
            <Wheel size={30} className="msg__avatar" />
            <div className="msg__body">
              <p>
                ¡Hola! Soy <strong>MecanicAI</strong>, tu mecánico con IA. Cuéntame qué le pasa a tu{' '}
                <strong>
                  {vehicle.brand} {vehicle.model}
                </strong>{' '}
                o qué necesitas saber: averías, ruidos, testigos del cuadro, mantenimiento, códigos OBD…
              </p>
              {messages.length === 0 && !busy && (
                <div className="suggestions">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" className="suggestion" onClick={() => suggest(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>

          {thread.map((message, index) =>
            message.role === 'user' ? (
              <UserMessage key={`user-${index}`} text={message.content} />
            ) : (
              <AiMessage
                key={`ai-${index}`}
                text={message.content}
                streaming={index === messages.length}
                model={vehicle.model}
              />
            ),
          )}

          {failure && (
            <div className="notice notice--error" role="alert">
              <Icon name="alert" size={20} />
              <span>{failure.message}</span>
              {failure.onRetry && (
                <button type="button" className="btn btn--ghost btn--xs" onClick={failure.onRetry}>
                  <Icon name="refresh" size={16} /> Reintentar
                </button>
              )}
            </div>
          )}
          {notice}
        </div>
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSubmit={(text) => void send(text)}
        onStop={onStop}
        busy={busy}
        disabled={inputDisabled}
        footer={footer}
        inputRef={inputRef}
      />
    </div>
  )
}

// Memorizados: mientras se escribe una respuesta, los mensajes anteriores no se vuelven a procesar en cada frame
const UserMessage = memo(function UserMessage({ text }: { text: string }) {
  return (
    <div className="msg msg--user">
      <div className="msg__bubble">{text}</div>
    </div>
  )
})

interface AiMessageProps {
  text: string
  /** La respuesta se está escribiendo (con el texto vacío, la IA aún no ha empezado). */
  streaming: boolean
  /** Modelo del coche, para el aviso mientras la IA empieza a responder. */
  model: string
}

const AiMessage = memo(function AiMessage({ text, streaming, model }: AiMessageProps) {
  const waiting = streaming && text === ''
  return (
    <article className="msg msg--ai" aria-live={streaming ? 'polite' : undefined} aria-busy={streaming || undefined}>
      <Wheel size={30} className="msg__avatar" spinning={waiting} />
      <div className="msg__body">
        {waiting ? (
          <p className="typing">
            Revisando tu {model}
            <span className="typing__dots" aria-hidden="true" />
          </p>
        ) : (
          <MarkdownText text={text} streaming={streaming} />
        )}
        {!streaming && <CopyButton text={text} />}
      </div>
    </article>
  )
})

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // El navegador no permite copiar
    }
  }
  return (
    <button type="button" className="msg__action" onClick={() => void copy()}>
      <Icon name={copied ? 'check' : 'copy'} size={15} />
      {copied ? 'Copiado' : 'Copiar'}
    </button>
  )
}

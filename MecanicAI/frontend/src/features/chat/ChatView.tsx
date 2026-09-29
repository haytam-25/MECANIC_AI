import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
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
  /** Devuelve false si el mensaje no se llegó a enviar (se recupera el texto). */
  onSend(text: string): Promise<boolean>
  onStop(): void
}

const SUGGESTIONS = [
  '¿Qué averías típicas tiene este modelo?',
  'Se me ha encendido un testigo en el cuadro, ¿qué puede ser?',
  'Hace un ruido raro al frenar, ¿qué puede ser?',
  '¿Qué mantenimiento le toca y cada cuánto?',
  'No arranca, ¿por dónde empiezo a revisar?',
  'Tengo un código de avería OBD: ',
]

export function ChatView(props: ChatViewProps) {
  const { vehicle, messages, streamingText, failure, notice, banner, footer, inputDisabled, onSend, onStop } = props
  const [draft, setDraft] = useState('')
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

  return (
    <div className="chat">
      <div className="vehicle-bar">
        <Hubcap label={brandAbbr(vehicle.brand)} size="sm" />
        <div className="vehicle-bar__text">
          <strong>{displayName(vehicle)}</strong>
          <span>{engine ?? 'Motorización sin especificar'}</span>
        </div>
        <Link to="/" className="btn btn--ghost btn--xs" aria-label="Cambiar de coche">
          <Icon name="swap" size={16} /> Cambiar
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

          {messages.map((message, index) => (
            <MessageItem key={message.id ?? `m-${index}`} message={message} />
          ))}

          {streamingText !== null && (
            <article className="msg msg--ai msg--streaming" aria-live="polite" aria-busy="true">
              <Wheel size={30} className="msg__avatar" spinning={streamingText === ''} />
              <div className="msg__body">
                {streamingText === '' ? (
                  <p className="typing">
                    Revisando tu {vehicle.model}
                    <span className="typing__dots" aria-hidden="true" />
                  </p>
                ) : (
                  <MarkdownText text={streamingText} />
                )}
              </div>
            </article>
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

function MessageItem({ message }: { message: ChatMessage }) {
  if (message.role === 'user') {
    return (
      <div className="msg msg--user">
        <div className="msg__bubble">{message.content}</div>
      </div>
    )
  }
  return (
    <article className="msg msg--ai">
      <Wheel size={30} className="msg__avatar" />
      <div className="msg__body">
        <MarkdownText text={message.content} />
        <CopyButton text={message.content} />
      </div>
    </article>
  )
}

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

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type Dispatch,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  type SetStateAction,
} from 'react'

import { Icon } from '../../components/Icon.tsx'
import { useToast } from '../../context/toast.ts'
import { useSpeechRecognition } from '../../lib/useSpeechRecognition.ts'

export const MAX_QUESTION = 4000

interface ComposerProps {
  value: string
  onChange: Dispatch<SetStateAction<string>>
  onSubmit(text: string): void
  onStop(): void
  busy: boolean
  disabled?: boolean
  footer?: ReactNode
  inputRef: RefObject<HTMLTextAreaElement | null>
}

function appendText(current: string, addition: string): string {
  if (!addition) return current
  if (!current.trim()) return addition.charAt(0).toUpperCase() + addition.slice(1)
  return `${current.replace(/\s+$/, '')} ${addition}`
}

/** Caja de texto del chat: crece con el contenido, dictado por voz y botón enviar/detener. */
export function Composer({ value, onChange, onSubmit, onStop, busy, disabled = false, footer, inputRef }: ComposerProps) {
  const toast = useToast()
  const speech = useSpeechRecognition(
    (text) => onChange((current) => appendText(current, text).slice(0, MAX_QUESTION)),
    (message) => toast(message, 'error'),
  )
  // En móvil "Intro" hace salto de línea (como en WhatsApp); en ordenador envía
  const touch = useMemo(() => window.matchMedia('(pointer: coarse)').matches, [])
  const localRef = useRef<HTMLTextAreaElement | null>(null)

  useLayoutEffect(() => {
    const el = localRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 168)}px`
  }, [value])

  const text = value.trim()
  const canSend = !busy && !disabled && text.length > 0 && value.length <= MAX_QUESTION

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    if (!canSend) return
    if (speech.listening) speech.stop()
    onSubmit(text)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !touch && !event.nativeEvent.isComposing) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      {speech.listening && (
        <div className="composer__listening" role="status">
          <span className="rec-dot" aria-hidden="true" />
          {speech.interim || 'Te escucho… habla con normalidad'}
        </div>
      )}
      <div className={`composer__box ${disabled ? 'composer__box--disabled' : ''}`}>
        <textarea
          ref={(el) => {
            localRef.current = el
            inputRef.current = el
          }}
          className="composer__input"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={disabled ? 'Has llegado al límite de mensajes de hoy' : 'Describe el problema o pregunta lo que necesites…'}
          aria-label="Tu mensaje"
          maxLength={MAX_QUESTION + 200}
          disabled={disabled}
          enterKeyHint={touch ? 'enter' : 'send'}
        />
        {speech.supported && !busy && (
          <button
            type="button"
            className={`composer__btn composer__mic ${speech.listening ? 'composer__mic--on' : ''}`}
            onClick={speech.listening ? speech.stop : speech.start}
            disabled={disabled}
            aria-label={speech.listening ? 'Parar el dictado' : 'Dictar por voz'}
            aria-pressed={speech.listening}
          >
            <Icon name="mic" size={22} />
          </button>
        )}
        {busy ? (
          <button type="button" className="composer__btn composer__send composer__send--stop" onClick={onStop} aria-label="Detener la respuesta">
            <Icon name="stop" size={20} />
          </button>
        ) : (
          <button type="submit" className="composer__btn composer__send" disabled={!canSend} aria-label="Enviar">
            <Icon name="send" size={22} />
          </button>
        )}
      </div>
      <div className="composer__foot">
        {value.length > MAX_QUESTION - 500 && (
          <span className={value.length > MAX_QUESTION ? 'text-danger' : ''}>
            {value.length}/{MAX_QUESTION}
          </span>
        )}
        {footer}
      </div>
    </form>
  )
}

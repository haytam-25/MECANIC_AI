import { useEffect, useId, useRef, useState } from 'react'

import { ApiError } from '../../api/http.ts'
import type { DocumentSection } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { useToast } from '../../context/toast.ts'
import { countdown, expiryStatus, isSaneExpiry, stampDate, todayIso, type ExpiryStatus } from './documents.ts'

/** La ITV "caduca" (caducada) y el seguro "vence" (vencido). */
const STAMP_WORDS: Record<string, Record<ExpiryStatus, string>> = {
  caduca: { ok: 'En vigor', soon: 'Caduca pronto', expired: 'Caducada' },
  vence: { ok: 'En vigor', soon: 'Vence pronto', expired: 'Vencido' },
}

/** Sello de goma con el estado de la ITV o el seguro. Cae con un golpe cada vez que cambia la fecha. */
export function ExpiryStamp({ iso, verb }: { iso: string; verb: string }) {
  const status = expiryStatus(iso)
  const word = (STAMP_WORDS[verb] ?? STAMP_WORDS.caduca)[status]
  return (
    <span className={`doc-stamp doc-stamp--${status}`} role="img" aria-label={`${word}: ${countdown(iso, verb)}`}>
      <span className="doc-stamp__word">{word}</span>
      <span className="doc-stamp__date">hasta {stampDate(iso)}</span>
    </span>
  )
}

interface ExpiryPanelProps {
  section: DocumentSection | null
  verb: string
  /** A dónde llegan los avisos. */
  email: string | null
  onSave(changes: { expiresOn: string | null; reminder: boolean }): Promise<void>
}

/** Fecha de caducidad y aviso por email. Se guarda solo (al terminar de escribir la fecha o al tocar el interruptor). */
export function ExpiryPanel({ section, verb, email, onSave }: ExpiryPanelProps) {
  const toast = useToast()
  const id = useId()
  const [date, setDate] = useState(section?.expiresOn ?? '')
  const [reminder, setReminder] = useState(section?.reminder ?? false)
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  /** Lo último que se mandó al servidor (para no repetirlo). */
  const sent = useRef({ expiresOn: section?.expiresOn ?? null, reminder: section?.reminder ?? false })
  const [rang, setRang] = useState(0)

  const commit = (nextDate: string, nextReminder: boolean) => {
    if (nextDate && !isSaneExpiry(nextDate)) return
    const expiresOn = nextDate || null
    const wantsReminder = expiresOn !== null && nextReminder
    if (expiresOn === sent.current.expiresOn && wantsReminder === sent.current.reminder) return
    const previous = sent.current
    sent.current = { expiresOn, reminder: wantsReminder }
    setState('saving')
    onSave({ expiresOn, reminder: wantsReminder })
      .then(() => setState('saved'))
      .catch((error: unknown) => {
        sent.current = previous
        setState('idle')
        toast(error instanceof ApiError ? error.message : 'No se pudo guardar la fecha.', 'error')
      })
  }

  // Al escribir la fecha a mano se espera a que termine; con el calendario del móvil llega de una vez
  useEffect(() => {
    const timer = window.setTimeout(() => commit(date, reminder), 700)
    return () => window.clearTimeout(timer)
    // commit cambia en cada render; solo importa la fecha
    // oxlint-disable-next-line react/exhaustive-deps
  }, [date])

  useEffect(() => {
    if (state !== 'saved') return
    const timer = window.setTimeout(() => setState('idle'), 1800)
    return () => window.clearTimeout(timer)
  }, [state])

  const validDate = date !== '' && isSaneExpiry(date)
  const on = reminder && validDate

  const toggle = () => {
    if (!validDate) return
    const next = !on
    setReminder(next)
    if (next) setRang((n) => n + 1)
    commit(date, next)
  }

  return (
    <div className={`doc-expiry ${validDate ? `doc-expiry--${expiryStatus(date)}` : ''}`}>
      <div className="doc-expiry__row">
        <label className="field doc-expiry__date" htmlFor={`${id}-date`}>
          <span className="field__label">
            <Icon name="calendar" size={14} /> {verb === 'vence' ? 'Vence el' : 'Caduca el'}
          </span>
          <input
            id={`${id}-date`}
            type="date"
            value={date}
            min="2000-01-01"
            onChange={(event) => setDate(event.target.value)}
            onBlur={() => commit(date, reminder)}
          />
        </label>
        <p className="doc-expiry__countdown" aria-live="polite">
          {validDate ? countdown(date, verb) : date === '' ? 'Sin fecha' : ''}
          {state !== 'idle' && (
            <span className={`doc-expiry__saved doc-expiry__saved--${state}`}>
              {state === 'saving' ? 'Guardando…' : (
                <>
                  <Icon name="check" size={13} /> Guardado
                </>
              )}
            </span>
          )}
        </p>
      </div>

      <div className={`doc-reminder ${on ? 'doc-reminder--on' : ''}`}>
        <span className="doc-reminder__bell" key={rang} aria-hidden="true">
          <Icon name="bell" size={20} />
        </span>
        <span className="doc-reminder__text">
          <strong id={`${id}-reminder`}>Avisarme por email</strong>
          <span className="small muted">
            {!validDate
              ? 'Pon la fecha para poder activar el aviso.'
              : on
                ? `Te escribiremos${email ? ` a ${email}` : ''} cada semana desde 2 meses antes.`
                : `Te escribimos cada semana desde 2 meses antes de que ${verb === 'vence' ? 'venza' : 'caduque'}.`}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby={`${id}-reminder`}
          className="doc-switch"
          disabled={!validDate}
          onClick={toggle}
        >
          <span className="doc-switch__knob" />
        </button>
      </div>

      {date !== '' && date < todayIso() && (
        <p className="doc-expiry__late small">
          <Icon name="alert" size={15} /> Ya ha caducado: renuévalo cuanto antes y actualiza la fecha.
        </p>
      )}
    </div>
  )
}

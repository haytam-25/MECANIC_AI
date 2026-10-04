import { useState, type FormEvent } from 'react'

import type {
  AnswerKind,
  ItemAnswer,
  MaintenancePlan,
  PlanItem,
  ReportInput,
  TimingAnswer,
  Usage,
} from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import {
  asksTimingType,
  emptyAnswer,
  intervalText,
  isAskable,
  quotaText,
  validate,
} from './health.ts'

interface ReportFormProps {
  plan: MaintenancePlan
  initial: ReportInput
  /** Informes que le quedan esta semana (si no le queda ninguno no se puede enviar). */
  quota: Usage
  submitting: boolean
  onSubmit(input: ReportInput): void
}

const KINDS: { kind: AnswerKind; label: string }[] = [
  { kind: 'known', label: 'Sé cuándo' },
  { kind: 'never', label: 'Nunca se ha cambiado' },
  { kind: 'unknown', label: 'No lo sé' },
]

const TIMING_OPTIONS: { value: TimingAnswer; label: string }[] = [
  { value: 'CORREA', label: 'Correa' },
  { value: 'CADENA', label: 'Cadena' },
  { value: 'NO_SE', label: 'No lo sé' },
]

/** Formulario: kilómetros actuales y, por cada elemento, hace cuántos km o cuánto tiempo se cambió. */
export function ReportForm({ plan, initial, quota, submitting, onSubmit }: ReportFormProps) {
  const [input, setInput] = useState<ReportInput>(initial)
  const [submitted, setSubmitted] = useState(false)
  const errors = submitted ? validate(plan, input) : {}

  const askable = plan.items.filter((item) => asksTimingType(plan, item) || isAskable(plan, item, input))
  const answered = askable.filter((item) =>
    asksTimingType(plan, item) && input.timing !== 'CORREA' ? input.timing !== null : input.answers[item.id] !== undefined,
  ).length

  const setAnswer = (id: string, change: Partial<ItemAnswer>) =>
    setInput((current) => ({
      ...current,
      answers: { ...current.answers, [id]: { ...(current.answers[id] ?? emptyAnswer()), ...change } },
    }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    const found = validate(plan, input)
    const first = Object.keys(found)[0]
    if (first) {
      document.getElementById(`campo-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    if (!submitting && quota.remaining > 0) onSubmit(input)
  }

  return (
    <form className="report-form" onSubmit={submit} noValidate>
      <section className="plate report-km" id="campo-currentKm">
        <label className="field">
          <span className="field__label">¿Cuántos kilómetros tiene ahora?</span>
          <span className="unit-input">
            <input
              value={input.currentKm}
              onChange={(e) => setInput((c) => ({ ...c, currentKm: e.target.value }))}
              inputMode="numeric"
              placeholder="Ej.: 125000"
              maxLength={11}
              aria-invalid={Boolean(errors.currentKm)}
              aria-describedby={errors.currentKm ? 'error-currentKm' : undefined}
            />
            <span className="unit-input__unit">km</span>
          </span>
        </label>
        {errors.currentKm && (
          <p className="field-error" id="error-currentKm">
            {errors.currentKm}
          </p>
        )}
      </section>

      <p className="muted small report-form__hint">
        Indica hace cuántos kilómetros <strong>o</strong> cuánto tiempo se cambió cada cosa (con uno basta). Lo
        encontrarás en el libro de mantenimiento o en las facturas del taller.
      </p>

      <ol className="report-items">
        {plan.items.map((item) => (
          <ItemField
            key={item.id}
            plan={plan}
            item={item}
            input={input}
            error={errors[item.id]}
            onAnswer={(change) => setAnswer(item.id, change)}
            onTiming={(timing) => setInput((c) => ({ ...c, timing }))}
          />
        ))}
      </ol>

      <div className="report-form__submit">
        <span className="small muted">
          {answered} de {askable.length} respondidos · {quotaText(quota)}
        </span>
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting || quota.remaining === 0}>
          <Icon name="pulse" size={20} /> {submitting ? 'Preparando el informe…' : 'Ver mi informe'}
        </button>
      </div>
    </form>
  )
}

interface ItemFieldProps {
  plan: MaintenancePlan
  item: PlanItem
  input: ReportInput
  error?: string
  onAnswer(change: Partial<ItemAnswer>): void
  onTiming(timing: TimingAnswer): void
}

function ItemField({ plan, item, input, error, onAnswer, onTiming }: ItemFieldProps) {
  const askType = asksTimingType(plan, item)
  const askable = isAskable(plan, item, input)
  const answer = input.answers[item.id]
  const interval = askType && input.timing !== 'CORREA' ? null : intervalText(item)
  const title = askType && input.timing === 'CORREA' ? 'Correa de distribución' : askType && input.timing === 'CADENA' ? 'Cadena de distribución' : item.name
  const errorId = `error-${item.id}`
  // La nota general de la distribución (p. ej. el aceite que exige una correa bañada en aceite) va con su elemento
  const note = item.note ?? (item.id === 'DISTRIBUCION' && plan.timing !== 'DESCONOCIDA' ? plan.timingNote : null)

  return (
    <li className="plate item-field" id={`campo-${item.id}`}>
      <div className="item-field__head">
        <h3 className="item-field__title">{title}</h3>
        {item.critical && <span className="chip chip--critical">{item.id === 'DISTRIBUCION' ? 'Motor' : 'Seguridad'}</span>}
      </div>
      <p className="muted small">{item.description}</p>
      {interval && (
        <p className="item-field__interval">
          <Icon name="refresh" size={16} /> {interval}
        </p>
      )}
      {note && (
        <p className="item-field__note">
          <Icon name="wrench" size={16} /> {note}
        </p>
      )}

      {askType && (
        <fieldset className="field">
          <legend className="field__label">¿Tu motor lleva correa o cadena?</legend>
          <div className="chip-row">
            {TIMING_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`chip chip--button ${input.timing === option.value ? 'chip--selected' : ''}`}
                aria-pressed={input.timing === option.value}
                onClick={() => onTiming(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!askable && !askType && <p className="small item-field__chain">No tiene cambio programado: no hace falta indicar nada.</p>}

      {askable && (
        <fieldset className="field">
          <legend className="field__label">¿Cuándo se cambió por última vez?</legend>
          <div className="chip-row">
            {KINDS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                className={`chip chip--button ${answer?.kind === kind ? 'chip--selected' : ''}`}
                aria-pressed={answer?.kind === kind}
                onClick={() => onAnswer({ kind })}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {askable && answer?.kind === 'known' && (
        <div className="item-field__inputs">
          {item.intervalKm !== null && (
            <label className="field">
              <span className="field__label">Hace…</span>
              <span className="unit-input">
                <input
                  value={answer.km}
                  onChange={(e) => onAnswer({ km: e.target.value })}
                  inputMode="numeric"
                  placeholder="Ej.: 8000"
                  maxLength={11}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
                <span className="unit-input__unit">km</span>
              </span>
            </label>
          )}
          {item.intervalKm !== null && item.intervalMonths !== null && <span className="item-field__or">o</span>}
          {item.intervalMonths !== null && (
            <label className="field">
              <span className="field__label">Hace…</span>
              <span className="unit-input">
                <input
                  value={answer.time}
                  onChange={(e) => onAnswer({ time: e.target.value })}
                  inputMode="decimal"
                  placeholder="Ej.: 10"
                  maxLength={6}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? errorId : undefined}
                />
                <select
                  className="unit-input__select"
                  value={answer.unit}
                  onChange={(e) => onAnswer({ unit: e.target.value === 'años' ? 'años' : 'meses' })}
                  aria-label="Unidad de tiempo"
                >
                  <option value="meses">meses</option>
                  <option value="años">años</option>
                </select>
              </span>
            </label>
          )}
        </div>
      )}
      {askable && answer?.kind === 'never' && (
        <p className="small muted">Lo calcularé desde que el coche era nuevo ({item.intervalKm !== null ? 'con sus km actuales y ' : ''}su año).</p>
      )}
      {error && (
        <p className="field-error" id={errorId}>
          {error}
        </p>
      )}
    </li>
  )
}

import { useId, useRef, useState, type FormEvent } from 'react'

import type { MaintenancePlan, Repair, Vehicle } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { Wheel } from '../../components/Wheel.tsx'
import { formatKm, parseKm } from '../report/health.ts'
import {
  addDays,
  formatDate,
  formatPrice,
  isoDate,
  MAX_NOTES,
  MAX_WORKSHOP,
  parsePrice,
  repairTypes,
  typeLabel,
  validateDraft,
  type DraftErrors,
  type RepairDraft,
  type RepairType,
} from './diary.ts'

interface RepairFormProps {
  vehicle: Vehicle
  /** Plan de mantenimiento del coche: undefined mientras se carga, null si no se pudo cargar. */
  plan: MaintenancePlan | null | undefined
  initial: RepairDraft
  /** Las demás reparaciones de este coche (para sugerir km y talleres). */
  others: Repair[]
  editing: boolean
  submitting: boolean
  onSubmit(draft: RepairDraft): void
}

const STEPS = [
  { title: '¿Qué se le hizo?', short: 'Qué' },
  { title: '¿Cuándo fue?', short: 'Cuándo' },
  { title: 'Precio y detalles', short: 'Detalles' },
] as const

/** Campos de cada paso: no se pasa al siguiente si alguno tiene un error. */
const STEP_FIELDS: (keyof RepairDraft)[][] = [['types'], ['date', 'km'], ['price', 'workshop', 'notes']]

const SELF = 'Yo mismo'

/** Formulario por pasos para apuntar (o corregir) una reparación del diario. */
export function RepairForm({ vehicle, plan, initial, others, editing, submitting, onSubmit }: RepairFormProps) {
  const [draft, setDraft] = useState<RepairDraft>(initial)
  const [step, setStep] = useState(0)
  // Los errores de un paso se enseñan al intentar pasar de él
  const [checked, setChecked] = useState<Set<number>>(() => new Set())
  const topRef = useRef<HTMLFormElement>(null)
  const [today] = useState(() => isoDate(new Date()))

  const allErrors = validateDraft(draft, today)
  const stepErrors = (i: number): DraftErrors =>
    Object.fromEntries(STEP_FIELDS[i].filter((f) => allErrors[f]).map((f) => [f, allErrors[f]]))
  const stepValid = (i: number) => Object.keys(stepErrors(i)).length === 0
  const errors: DraftErrors = checked.has(step) ? stepErrors(step) : {}
  const reachable = (i: number) => STEP_FIELDS.slice(0, i).every((_, j) => stepValid(j))

  const change = (patch: Partial<RepairDraft>) => setDraft((d) => ({ ...d, ...patch }))

  const goTo = (i: number) => {
    setStep(i)
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const next = (event: FormEvent) => {
    event.preventDefault()
    setChecked((c) => new Set(c).add(step))
    if (!stepValid(step)) return
    if (step < STEPS.length - 1) goTo(step + 1)
    else if (!submitting) onSubmit(draft)
  }

  return (
    <form className="repair-form" onSubmit={next} noValidate ref={topRef}>
      <ol className="repair-steps" aria-label="Pasos">
        {STEPS.map((s, i) => (
          <li key={s.short}>
            <button
              type="button"
              className={`repair-steps__step ${i === step ? 'repair-steps__step--current' : ''} ${i < step || (editing && stepValid(i)) ? 'repair-steps__step--done' : ''}`}
              aria-current={i === step ? 'step' : undefined}
              disabled={!reachable(i)}
              onClick={() => goTo(i)}
            >
              <span className="repair-steps__num">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
              <span className="repair-steps__label">{s.short}</span>
            </button>
          </li>
        ))}
      </ol>

      <h2 className="repair-form__title">{STEPS[step].title}</h2>

      {step === 0 && (
        <TypesStep vehicle={vehicle} plan={plan} selected={draft.types} error={errors.types} onChange={(types) => change({ types })} />
      )}
      {step === 1 && <WhenStep draft={draft} today={today} others={others} errors={errors} onChange={change} />}
      {step === 2 && <DetailsStep draft={draft} plan={plan ?? null} others={others} errors={errors} onChange={change} />}

      <div className="repair-form__nav">
        {step > 0 && (
          <button type="button" className="btn btn--ghost" onClick={() => goTo(step - 1)}>
            <Icon name="back" size={18} /> Atrás
          </button>
        )}
        <button type="submit" className="btn btn--primary repair-form__next" disabled={submitting}>
          {step < STEPS.length - 1 ? (
            <>
              Siguiente <Icon name="next" size={18} />
            </>
          ) : (
            <>
              <Icon name="check" size={18} /> {submitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar reparación'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}

interface TypesStepProps {
  vehicle: Vehicle
  plan: MaintenancePlan | null | undefined
  selected: string[]
  error?: string
  onChange(types: string[]): void
}

function TypesStep({ vehicle, plan, selected, error, onChange }: TypesStepProps) {
  if (plan === undefined) {
    return (
      <div className="repair-loading" aria-busy="true">
        <Wheel size={48} spinning title="Cargando" />
        <span className="muted small">Preparando el mantenimiento de tu {vehicle.model}…</span>
      </div>
    )
  }
  const { maintenance, other } = repairTypes(plan, vehicle.fuel)
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])

  return (
    <>
      <p className="muted small">Puedes marcar varias cosas: por ejemplo, una revisión con aceite y filtros.</p>

      <section className="repair-group" aria-labelledby="grupo-mantenimiento">
        <h3 className="section-label" id="grupo-mantenimiento">
          Mantenimiento {plan ? `de tu ${vehicle.model}` : ''}
        </h3>
        <div className="type-grid">
          {maintenance.map((type) => (
            <TypeTile key={type.id} type={type} selected={selected.includes(type.id)} onToggle={() => toggle(type.id)} />
          ))}
        </div>
      </section>

      <section className="repair-group" aria-labelledby="grupo-averias">
        <h3 className="section-label" id="grupo-averias">
          Reparaciones y otros trabajos
        </h3>
        <div className="chip-row">
          {other.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`chip chip--button ${selected.includes(type.id) ? 'chip--selected' : ''}`}
              aria-pressed={selected.includes(type.id)}
              onClick={() => toggle(type.id)}
            >
              {selected.includes(type.id) && <Icon name="check" size={14} />}
              {type.label}
            </button>
          ))}
        </div>
      </section>

      <p className={error ? 'field-error' : 'small muted'} role={error ? 'alert' : undefined}>
        {error ??
          (selected.length === 0
            ? 'Aún no has marcado nada.'
            : `${selected.length === 1 ? '1 elegido' : `${selected.length} elegidos`}: ${selected.map((id) => typeLabel(id, plan)).join(', ')}`)}
      </p>
    </>
  )
}

function TypeTile({ type, selected, onToggle }: { type: RepairType; selected: boolean; onToggle(): void }) {
  return (
    <button type="button" className={`type-tile ${selected ? 'type-tile--selected' : ''}`} aria-pressed={selected} onClick={onToggle}>
      <span className="type-tile__check" aria-hidden="true">
        {selected && <Icon name="check" size={14} />}
      </span>
      <span className="type-tile__text">
        <span className="type-tile__label">{type.label}</span>
        {type.hint && <span className="type-tile__hint">{type.hint}</span>}
      </span>
    </button>
  )
}

interface FieldsStepProps {
  draft: RepairDraft
  others: Repair[]
  errors: DraftErrors
  onChange(patch: Partial<RepairDraft>): void
}

function WhenStep({ draft, today, others, errors, onChange }: FieldsStepProps & { today: string }) {
  const kmId = useId()
  const yesterday = addDays(today, -1)
  const last = others[0]
  const km = parseKm(draft.km)
  // Aviso (no bloquea): menos km que en una reparación anterior
  const earlierWithMoreKm =
    km !== null ? others.find((r) => r.date < draft.date && r.km > km) : undefined

  return (
    <>
      <div className="plate repair-fields">
        <div className="field">
          <label className="field__label" htmlFor="repair-date">
            Fecha
          </label>
          <div className="chip-row">
            {[
              { value: today, label: 'Hoy' },
              { value: yesterday, label: 'Ayer' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                className={`chip chip--button ${draft.date === option.value ? 'chip--selected' : ''}`}
                aria-pressed={draft.date === option.value}
                onClick={() => onChange({ date: option.value })}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            id="repair-date"
            type="date"
            value={draft.date}
            max={today}
            min="1950-01-01"
            onChange={(e) => onChange({ date: e.target.value })}
            aria-invalid={Boolean(errors.date)}
            aria-describedby={errors.date ? 'error-date' : undefined}
          />
          {errors.date && (
            <p className="field-error" id="error-date">
              {errors.date}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={kmId}>
            Kilómetros que tenía el coche
          </label>
          <span className="unit-input">
            <input
              id={kmId}
              value={draft.km}
              onChange={(e) => onChange({ km: e.target.value })}
              inputMode="numeric"
              placeholder={last ? `Ej.: ${last.km + 1000}` : 'Ej.: 125000'}
              maxLength={11}
              aria-invalid={Boolean(errors.km)}
              aria-describedby={errors.km ? 'error-km' : undefined}
            />
            <span className="unit-input__unit">km</span>
          </span>
          {last && (
            <p className="small muted">
              Última reparación apuntada: {formatKm(last.km)} el {formatDate(last.date)}.
            </p>
          )}
          {errors.km && (
            <p className="field-error" id="error-km">
              {errors.km}
            </p>
          )}
          {!errors.km && earlierWithMoreKm && (
            <p className="small repair-warning">
              <Icon name="alert" size={16} /> Son menos km que en la reparación del {formatDate(earlierWithMoreKm.date)} (
              {formatKm(earlierWithMoreKm.km)}). Revisa que estén bien.
            </p>
          )}
        </div>
      </div>
    </>
  )
}

function DetailsStep({ draft, plan, others, errors, onChange }: FieldsStepProps & { plan: MaintenancePlan | null }) {
  const priceId = useId()
  const workshopId = useId()
  const notesId = useId()
  // Talleres ya usados en este coche, para elegirlos con un toque
  const workshops = [...new Set(others.map((r) => r.workshop).filter((w): w is string => Boolean(w)))]
    .filter((w) => w !== SELF)
    .slice(0, 3)
  const price = parsePrice(draft.price)
  const km = parseKm(draft.km)

  return (
    <>
      <div className="plate repair-fields">
        <div className="field">
          <label className="field__label" htmlFor={priceId}>
            Precio <span className="muted">(opcional)</span>
          </label>
          <span className="unit-input repair-price">
            <input
              id={priceId}
              value={draft.price}
              onChange={(e) => onChange({ price: e.target.value })}
              inputMode="decimal"
              placeholder="Ej.: 129,90"
              maxLength={12}
              aria-invalid={Boolean(errors.price)}
              aria-describedby={errors.price ? 'error-price' : undefined}
            />
            <span className="unit-input__unit">€</span>
          </span>
          {errors.price && (
            <p className="field-error" id="error-price">
              {errors.price}
            </p>
          )}
        </div>

        <div className="field">
          <label className="field__label" htmlFor={workshopId}>
            ¿Dónde se hizo? <span className="muted">(opcional)</span>
          </label>
          <div className="chip-row">
            {[...workshops, SELF].map((w) => (
              <button
                key={w}
                type="button"
                className={`chip chip--button ${draft.workshop === w ? 'chip--selected' : ''}`}
                aria-pressed={draft.workshop === w}
                onClick={() => onChange({ workshop: draft.workshop === w ? '' : w })}
              >
                {w}
              </button>
            ))}
          </div>
          <input
            id={workshopId}
            value={draft.workshop}
            onChange={(e) => onChange({ workshop: e.target.value })}
            placeholder="Taller, concesionario…"
            maxLength={MAX_WORKSHOP}
            aria-invalid={Boolean(errors.workshop)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor={notesId}>
            Observaciones <span className="muted">(opcional)</span>
          </label>
          <textarea
            id={notesId}
            className="repair-notes"
            value={draft.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            rows={4}
            maxLength={MAX_NOTES}
            placeholder="Ej.: aceite 5W30, me avisaron de que las pastillas traseras están al 30 %…"
            aria-invalid={Boolean(errors.notes)}
          />
          <span className="small muted repair-notes__count">
            {draft.notes.length} / {MAX_NOTES}
          </span>
        </div>
      </div>

      <section className="plate repair-summary" aria-label="Resumen">
        <h3 className="section-label">Resumen</h3>
        <div className="chip-row">
          {draft.types.map((id) => (
            <span key={id} className="chip">
              {typeLabel(id, plan)}
            </span>
          ))}
        </div>
        <p className="small">
          {formatDate(draft.date)}
          {km !== null && ` · ${formatKm(km)}`}
          {typeof price === 'number' && ` · ${formatPrice(price)}`}
          {draft.workshop.trim() && ` · ${draft.workshop.trim()}`}
        </p>
      </section>
    </>
  )
}

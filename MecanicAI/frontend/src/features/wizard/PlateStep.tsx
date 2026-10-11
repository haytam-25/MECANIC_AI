import { useState, type FormEvent } from 'react'

import { Wheel } from '../../components/Wheel.tsx'
import { normalizePlate, PLATE_MAX_LENGTH } from '../../lib/vehicle.ts'
import { StepHead } from './parts.tsx'

interface PlateStepProps {
  /** "SEAT León de 2016" */
  carName: string
  saving: boolean
  /** `plate`: ya normalizada ("1234BCD"), o null si no se quiere indicar. */
  onSubmit(plate: string | null): void
  onBack(): void
}

/** Último paso, opcional: la matrícula, para distinguir el coche en el garaje y en el PDF de sus reparaciones. */
export function PlateStep({ carName, saving, onSubmit, onBack }: PlateStepProps) {
  const [value, setValue] = useState('')
  const plate = normalizePlate(value)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (plate) onSubmit(plate)
  }

  return (
    <div className="step">
      <StepHead title="¿Cuál es su matrícula?" subtitle={`${carName} · opcional`} onBack={saving ? undefined : onBack} />

      {saving ? (
        <div className="loading-row" aria-busy="true">
          <Wheel size={32} spinning />
          <span className="muted">Guardando en tu garaje…</span>
        </div>
      ) : (
        <>
          <form className="manual-form" onSubmit={submit}>
            <label className="field">
              <span className="field__label">Matrícula (opcional)</span>
              <input
                className="plate-input"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^A-Za-z0-9 -]/g, ''))}
                placeholder="1234 BCD"
                maxLength={PLATE_MAX_LENGTH}
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="done"
              />
            </label>
            <p className="muted small">
              Sirve para distinguir tus coches y aparece en el PDF del historial de reparaciones. No se envía a la IA.
            </p>
            <button type="submit" className="btn btn--primary btn--block" disabled={!plate}>
              Guardar y continuar
            </button>
          </form>
          <div className="step-alt">
            <button type="button" className="btn btn--ghost btn--block" onClick={() => onSubmit(null)}>
              Continuar sin matrícula
            </button>
          </div>
        </>
      )}
    </div>
  )
}

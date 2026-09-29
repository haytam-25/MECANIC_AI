import { useEffect, useState, type FormEvent } from 'react'

import { fetchEngines } from '../../api/endpoints.ts'
import { isAbort } from '../../api/http.ts'
import type { EngineSuggestions, Fuel, VehicleSpec } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { Wheel } from '../../components/Wheel.tsx'
import { FUEL_LABELS, FUELS } from '../../lib/vehicle.ts'
import { StepHead } from './parts.tsx'
import { type PickedBrand, type PickedModel } from './selection.ts'

export type EngineChoice = Pick<VehicleSpec, 'engine' | 'fuel' | 'powerCv'>

interface EngineStepProps {
  brand: PickedBrand
  model: PickedModel
  year: number
  saving: boolean
  onPick(choice: EngineChoice): void
  onBack(): void
}

type Mode = 'list' | 'manual' | 'unknown'

export function EngineStep({ brand, model, year, saving, onPick, onBack }: EngineStepProps) {
  // Solo se pueden sugerir motorizaciones de coches del catálogo y de un año de venta conocido
  const canSuggest = Boolean(brand.id && model.id && model.years.includes(year))
  const [mode, setMode] = useState<Mode>(canSuggest ? 'list' : 'manual')
  const [suggestions, setSuggestions] = useState<EngineSuggestions | null>(null)

  useEffect(() => {
    if (!canSuggest || !brand.id || !model.id) return
    const controller = new AbortController()
    fetchEngines(brand.id, model.id, year, controller.signal)
      .then(setSuggestions)
      .catch((error: unknown) => {
        if (!isAbort(error)) setSuggestions({ engines: [], source: 'unavailable' })
      })
    return () => controller.abort()
  }, [canSuggest, brand.id, model.id, year])

  return (
    <div className="step">
      <StepHead title="¿Qué motor lleva?" subtitle={`${brand.name} ${model.name} de ${year}`} onBack={onBack} />

      {saving && (
        <div className="loading-row" aria-busy="true">
          <Wheel size={32} spinning />
          <span className="muted">Preparando el chat…</span>
        </div>
      )}

      {!saving && mode === 'list' && (
        <>
          {suggestions === null ? (
            <div className="engine-loading" aria-busy="true">
              <Wheel size={52} spinning />
              <p>
                Consultando las motorizaciones del {brand.name} {model.name} de {year}…
              </p>
            </div>
          ) : suggestions.engines.length === 0 ? (
            <div className="notice">
              <Icon name="alert" size={20} />
              <span>No he podido encontrar sus motorizaciones. Escríbela tú o dime solo el combustible.</span>
            </div>
          ) : (
            <>
              <ul className="engine-list">
                {suggestions.engines.map((engine) => (
                  <li key={`${engine.name}-${engine.fuel}-${engine.powerCv}`}>
                    <button
                      type="button"
                      className="engine-card"
                      onClick={() => onPick({ engine: engine.name, fuel: engine.fuel, powerCv: engine.powerCv })}
                    >
                      <span className="engine-card__name">{engine.name}</span>
                      <span className="engine-card__chips">
                        {engine.powerCv && <span className="chip">{engine.powerCv} CV</span>}
                        {engine.fuel && <FuelChip fuel={engine.fuel} />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="muted small">
                {suggestions.source === 'demo'
                  ? 'Lista de ejemplo: la IA está en modo demo.'
                  : 'Lista sugerida por la IA. Si dudas, míralo en la ficha técnica o en el permiso de circulación.'}
              </p>
            </>
          )}
        </>
      )}

      {!saving && mode === 'manual' && <ManualEngineForm onSubmit={onPick} />}

      {!saving && mode === 'unknown' && (
        <div className="fuel-picker">
          <p>¿Sabes al menos qué combustible usa?</p>
          <div className="chip-row">
            {FUELS.filter((f) => f !== 'GNC').map((fuel) => (
              <button key={fuel} type="button" className="chip chip--button" onClick={() => onPick({ engine: null, fuel, powerCv: null })}>
                {FUEL_LABELS[fuel]}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--ghost btn--block" onClick={() => onPick({ engine: null, fuel: null, powerCv: null })}>
            Tampoco lo sé, continuar
          </button>
        </div>
      )}

      {!saving && (
        <div className="step-alt">
          {mode !== 'unknown' && (
            <button type="button" className="btn btn--ghost btn--block" onClick={() => setMode('unknown')}>
              No sé qué motor tiene
            </button>
          )}
          {mode !== 'manual' && (
            <button type="button" className="link-btn" onClick={() => setMode('manual')}>
              <Icon name="edit" size={16} /> Escribir la motorización
            </button>
          )}
          {mode !== 'list' && canSuggest && (
            <button type="button" className="link-btn" onClick={() => setMode('list')}>
              Ver la lista de motores
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function FuelChip({ fuel }: { fuel: Fuel }) {
  return <span className={`chip chip--fuel chip--${fuel.toLowerCase()}`}>{FUEL_LABELS[fuel]}</span>
}

function ManualEngineForm({ onSubmit }: { onSubmit(choice: EngineChoice): void }) {
  const [engine, setEngine] = useState('')
  const [fuel, setFuel] = useState<Fuel | null>(null)
  const [power, setPower] = useState('')
  const powerCv = Number.parseInt(power, 10)
  const validPower = power === '' || (powerCv >= 1 && powerCv <= 2000)
  const valid = (engine.trim().length > 0 || fuel !== null) && validPower

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    onSubmit({ engine: engine.trim() || null, fuel, powerCv: power === '' ? null : powerCv })
  }

  return (
    <form className="manual-form" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Motor</span>
        <input
          value={engine}
          onChange={(e) => setEngine(e.target.value)}
          placeholder="Ej.: 1.6 TDI, 1.2 PureTech, 1.5 dCi…"
          maxLength={100}
        />
      </label>
      <fieldset className="field">
        <legend className="field__label">Combustible</legend>
        <div className="chip-row">
          {FUELS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip chip--button ${fuel === f ? 'chip--selected' : ''}`}
              aria-pressed={fuel === f}
              onClick={() => setFuel(fuel === f ? null : f)}
            >
              {FUEL_LABELS[f]}
            </button>
          ))}
        </div>
      </fieldset>
      <label className="field field--short">
        <span className="field__label">Potencia (CV, opcional)</span>
        <input
          value={power}
          onChange={(e) => setPower(e.target.value.replace(/\D/g, ''))}
          inputMode="numeric"
          maxLength={4}
          aria-invalid={!validPower}
        />
      </label>
      <button type="submit" className="btn btn--primary btn--block" disabled={!valid}>
        Abrir el chat
      </button>
    </form>
  )
}

import { useEffect, useState, type FormEvent } from 'react'

import { fetchEngines } from '../../api/endpoints.ts'
import type { EngineOption, EngineSuggestions, Fuel, VehicleSpec } from '../../api/types.ts'
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
  savingText?: string
  onPick(choice: EngineChoice): void
  onBack(): void
}

type Mode = 'list' | 'manual' | 'unknown'

/** Marcas en las que la IA devuelve también el código de motor (ver EngineSuggestionService). */
const BRANDS_WITH_CODES = new Set(['bmw', 'volkswagen', 'audi'])

const MANUAL_PLACEHOLDERS: Record<string, string> = {
  bmw: 'Ej.: 118d, 320d (N47), 330d (M57)…',
  volkswagen: 'Ej.: 1.9 TDI (BKC), 2.0 TDI (BKD)…',
  audi: 'Ej.: 2.0 TDI (CAGA), 1.8 TFSI…',
}

/**
 * El código va junto al nombre para que se guarde con el coche y le llegue al mecánico IA:
 * "330d (M57)", o "330d (E46) · M57" si el nombre ya lleva la generación entre paréntesis.
 */
function engineName(engine: EngineOption): string {
  if (!engine.code) return engine.name
  return engine.name.includes('(') ? `${engine.name} · ${engine.code}` : `${engine.name} (${engine.code})`
}

export function EngineStep({ brand, model, year, saving, savingText = 'Preparando el chat…', onPick, onBack }: EngineStepProps) {
  // Solo se pueden sugerir motorizaciones de coches del catálogo y de un año de venta conocido
  const canSuggest = Boolean(brand.id && model.id && model.years.includes(year))
  const [mode, setMode] = useState<Mode>(canSuggest ? 'list' : 'manual')
  const [suggestions, setSuggestions] = useState<EngineSuggestions | null>(null)

  useEffect(() => {
    if (!canSuggest || !brand.id || !model.id) return
    let active = true
    fetchEngines(brand.id, model.id, year)
      .then((result) => active && setSuggestions(result))
      .catch(() => active && setSuggestions({ engines: [], source: 'unavailable' }))
    return () => {
      active = false
    }
  }, [canSuggest, brand.id, model.id, year])

  return (
    <div className="step">
      <StepHead title="¿Qué motor lleva?" subtitle={`${brand.name} ${model.name} de ${year}`} onBack={onBack} />

      {saving && (
        <div className="loading-row" aria-busy="true">
          <Wheel size={32} spinning />
          <span className="muted">{savingText}</span>
        </div>
      )}

      {!saving && mode === 'list' && (
        <>
          {suggestions === null ? (
            <EngineLoading
              carName={`${brand.name} ${model.name} de ${year}`}
              withCodes={Boolean(brand.id && BRANDS_WITH_CODES.has(brand.id))}
            />
          ) : suggestions.engines.length === 0 ? (
            <div className="notice">
              <Icon name="alert" size={20} />
              <span>No he podido encontrar sus motorizaciones. Escríbela tú o dime solo el combustible.</span>
            </div>
          ) : (
            <>
              <ul className="engine-list">
                {suggestions.engines.map((engine) => (
                  <li key={`${engine.name}-${engine.fuel}-${engine.powerCv}-${engine.code ?? ''}`}>
                    <button
                      type="button"
                      className="engine-card"
                      onClick={() => onPick({ engine: engineName(engine), fuel: engine.fuel, powerCv: engine.powerCv })}
                    >
                      <span className="engine-card__name">
                        {engine.name}
                        {engine.code && (
                          <span className="engine-card__code" title="Código de motor">
                            {engine.code}
                          </span>
                        )}
                      </span>
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
                  : brand.id && BRANDS_WITH_CODES.has(brand.id)
                    ? 'Lista y códigos de motor sugeridos por la IA. Si dudas, el código viene en la ficha técnica o grabado en el bloque motor.'
                    : 'Lista sugerida por la IA. Si dudas, míralo en la ficha técnica o en el permiso de circulación.'}
              </p>
            </>
          )}
        </>
      )}

      {!saving && mode === 'manual' && (
        <ManualEngineForm placeholder={(brand.id && MANUAL_PLACEHOLDERS[brand.id]) || undefined} onSubmit={onPick} />
      )}

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

/** Cada cuánto cambia el texto mientras la IA busca los motores. */
const LOADING_STEP_MS = 3000

/**
 * La IA puede tardar 10-20 s en devolver la lista: el texto va cambiando para que se vea que la búsqueda sigue en
 * marcha y la página no se ha quedado colgada. El último mensaje se queda fijo hasta que llega la respuesta.
 */
function EngineLoading({ carName, withCodes }: { carName: string; withCodes: boolean }) {
  const messages = [
    `Consultando las motorizaciones del ${carName}…`,
    'Clasificándolas por tipo de combustible…',
    withCodes ? 'Buscando el código de cada motor…' : 'Comprobando potencias y versiones…',
    'Preparando la lista de motores encontrados…',
    'Revisando que los datos sean correctos…',
    'Casi listo, un momento más…',
  ]
  const last = messages.length - 1
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index >= last) return
    const timer = setTimeout(() => setIndex(index + 1), LOADING_STEP_MS)
    return () => clearTimeout(timer)
  }, [index, last])

  return (
    <div className="engine-loading" aria-busy="true">
      <Wheel size={52} spinning />
      <p key={index} className="engine-loading__text" role="status" aria-live="polite">
        {messages[index]}
      </p>
    </div>
  )
}

export function FuelChip({ fuel }: { fuel: Fuel }) {
  return <span className={`chip chip--fuel chip--${fuel.toLowerCase()}`}>{FUEL_LABELS[fuel]}</span>
}

function ManualEngineForm({
  placeholder = 'Ej.: 1.6 TDI, 1.2 PureTech, 1.5 dCi…',
  onSubmit,
}: {
  placeholder?: string
  onSubmit(choice: EngineChoice): void
}) {
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
          placeholder={placeholder}
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

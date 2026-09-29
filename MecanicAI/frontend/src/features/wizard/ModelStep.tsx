import { useEffect, useState } from 'react'

import { fetchModels } from '../../api/endpoints.ts'
import type { CarModel } from '../../api/types.ts'
import { normalizeText } from '../../lib/vehicle.ts'
import { LoadError, Loading, ManualCarForm, SearchInput, StepHead } from './parts.tsx'
import { ALL_YEARS, type PickedBrand, type PickedModel } from './selection.ts'

interface ModelStepProps {
  brand: PickedBrand
  onPick(model: PickedModel): void
  onBack(): void
}

export function ModelStep({ brand, onPick, onBack }: ModelStepProps) {
  const [models, setModels] = useState<CarModel[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState(false)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!brand.id) return
    let active = true
    fetchModels(brand.id)
      .then((list) => active && setModels(list))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [brand.id, attempt])

  const retry = () => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }

  const q = normalizeText(query)
  const visible = models?.filter((m) => normalizeText(m.name).includes(q)) ?? []

  return (
    <div className="step">
      <StepHead title={`¿Qué modelo de ${brand.name}?`} onBack={onBack} />
      {models && models.length > 10 && <SearchInput value={query} onChange={setQuery} label="Busca el modelo" />}

      {failed && <LoadError onRetry={retry} />}
      {!models && !failed && <Loading text="Cargando modelos…" />}

      {models && (
        <div className="model-grid">
          {visible.map((m) => (
            <button
              key={m.id}
              type="button"
              className="model-tile"
              onClick={() => onPick({ id: m.id, name: m.name, years: m.years })}
            >
              <span className="model-tile__name">{m.name}</span>
              <span className="model-tile__years">{m.yearsLabel}</span>
            </button>
          ))}
        </div>
      )}
      {models && q && visible.length === 0 && <p className="muted center">No encuentro «{query}».</p>}

      {manual ? (
        <ManualCarForm
          askBrand={false}
          onSubmit={(_brand, model) => onPick({ id: null, name: model, years: ALL_YEARS })}
          onCancel={() => setManual(false)}
        />
      ) : (
        <button type="button" className="link-btn center-block" onClick={() => setManual(true)}>
          ¿No está tu modelo? Escríbelo
        </button>
      )}
    </div>
  )
}

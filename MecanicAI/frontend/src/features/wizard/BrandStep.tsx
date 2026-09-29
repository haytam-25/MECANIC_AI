import { useEffect, useState } from 'react'

import { fetchBrands } from '../../api/endpoints.ts'
import type { Brand } from '../../api/types.ts'
import { Hubcap } from '../../components/Hubcap.tsx'
import { Icon } from '../../components/Icon.tsx'
import { brandAbbr, normalizeText } from '../../lib/vehicle.ts'
import { LoadError, Loading, ManualCarForm, SearchInput, StepHead } from './parts.tsx'
import { type PickedBrand } from './selection.ts'

interface BrandStepProps {
  onPick(brand: PickedBrand): void
  onManual(brand: PickedBrand, model: string): void
}

export function BrandStep({ onPick, onManual }: BrandStepProps) {
  const [brands, setBrands] = useState<Brand[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [manual, setManual] = useState(false)

  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchBrands()
      .then((list) => active && setBrands(list))
      .catch(() => active && setFailed(true))
    return () => {
      active = false
    }
  }, [attempt])

  const retry = () => {
    setFailed(false)
    setAttempt((n) => n + 1)
  }

  const q = normalizeText(query)
  const visible = brands?.filter((b) => normalizeText(b.name).includes(q)) ?? []
  const pick = (b: Brand) => onPick({ id: b.id, name: b.name, abbr: b.abbr })

  return (
    <div className="step">
      <StepHead title="¿De qué marca es tu coche?" />
      <SearchInput value={query} onChange={setQuery} label="Busca la marca (Seat, Toyota…)" />

      {failed && <LoadError onRetry={retry} />}
      {!brands && !failed && <Loading text="Cargando marcas…" />}

      {brands && !q && (
        <>
          <h3 className="section-label">Las más habituales</h3>
          <div className="brand-grid">
            {brands
              .filter((b) => b.popular)
              .map((b) => (
                <button key={b.id} type="button" className="brand-tile" onClick={() => pick(b)}>
                  <Hubcap label={b.abbr} />
                  <span className="brand-tile__name">{b.name}</span>
                </button>
              ))}
          </div>
          <h3 className="section-label">Todas las marcas</h3>
        </>
      )}

      {brands && (
        <ul className="option-list">
          {visible.map((b) => (
            <li key={b.id}>
              <button type="button" className="option-row" onClick={() => pick(b)}>
                <Hubcap label={b.abbr} size="sm" />
                <span className="option-row__name">{b.name}</span>
                <Icon name="next" size={18} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {brands && q && visible.length === 0 && <p className="muted center">No encuentro «{query}» en el catálogo.</p>}

      {manual ? (
        <ManualCarForm
          askBrand
          onSubmit={(brand, model) => onManual({ id: null, name: brand, abbr: brandAbbr(brand) }, model)}
          onCancel={() => setManual(false)}
        />
      ) : (
        <button type="button" className="link-btn center-block" onClick={() => setManual(true)}>
          ¿No está tu marca? Escríbela
        </button>
      )}
    </div>
  )
}

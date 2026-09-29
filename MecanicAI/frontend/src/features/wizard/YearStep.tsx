import { useState } from 'react'

import { StepHead } from './parts.tsx'
import { ALL_YEARS, type PickedModel } from './selection.ts'

interface YearStepProps {
  model: PickedModel
  onPick(year: number): void
  onBack(): void
}

export function YearStep({ model, onPick, onBack }: YearStepProps) {
  const [showAll, setShowAll] = useState(false)
  const years = showAll ? ALL_YEARS : model.years

  return (
    <div className="step">
      <StepHead title="¿De qué año es?" subtitle="El de fabricación o primera matriculación." onBack={onBack} />
      <div className="year-grid">
        {years.map((year) => (
          <button key={year} type="button" className="year-btn" onClick={() => onPick(year)}>
            {year}
          </button>
        ))}
      </div>
      {!showAll && model.years !== ALL_YEARS && (
        <button type="button" className="link-btn center-block" onClick={() => setShowAll(true)}>
          ¿No aparece tu año? Ver todos
        </button>
      )}
    </div>
  )
}

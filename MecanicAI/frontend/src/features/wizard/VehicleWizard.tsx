import { useEffect, useRef, useState, type CSSProperties } from 'react'

import type { VehicleSpec } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { BrandStep } from './BrandStep.tsx'
import { EngineStep, type EngineChoice } from './EngineStep.tsx'
import { ModelStep } from './ModelStep.tsx'
import { ALL_YEARS, type PickedBrand, type PickedModel } from './selection.ts'
import { YearStep } from './YearStep.tsx'
import './wizard.css'

const STEPS = ['Marca', 'Modelo', 'Año', 'Motor'] as const

interface VehicleWizardProps {
  /** Se llama con el coche completo; puede ser asíncrono (guardar y abrir el chat). */
  onComplete(vehicle: VehicleSpec): Promise<void> | void
}

/** Asistente de 4 pasos para elegir el coche: marca → modelo → año → motorización. */
export function VehicleWizard({ onComplete }: VehicleWizardProps) {
  const [step, setStep] = useState(0)
  const [brand, setBrand] = useState<PickedBrand | null>(null)
  const [model, setModel] = useState<PickedModel | null>(null)
  const [year, setYear] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const firstRender = useRef(true)

  // Al cambiar de paso, vuelve al principio del asistente (en móvil la lista puede ser larga)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    const top = topRef.current?.getBoundingClientRect().top ?? 0
    if (top < 0) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [step])

  const finish = async (engine: EngineChoice) => {
    if (!brand || !model || year === null) return
    setSaving(true)
    try {
      await onComplete({ brandId: brand.id, brand: brand.name, modelId: model.id, model: model.name, year, ...engine })
    } finally {
      setSaving(false)
    }
  }

  const values: (string | null)[] = [brand?.name ?? null, model?.name ?? null, year ? String(year) : null, null]

  return (
    <section className="wizard plate" ref={topRef} aria-label="Elige tu coche">
      <ol className="stepper" style={{ '--progress': step / (STEPS.length - 1) } as CSSProperties}>
        {STEPS.map((label, i) => {
          const state = i < step ? 'done' : i === step ? 'current' : 'todo'
          // Con marca y modelo escritos a mano no hay paso de modelo al que volver
          const reachable = i < step && !(i === 1 && brand?.id === null)
          return (
            <li key={label} className={`stepper__item stepper__item--${state}`}>
              <button
                type="button"
                className="stepper__nut"
                disabled={!reachable}
                onClick={() => setStep(i)}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`Paso ${i + 1}: ${label}${values[i] ? ` (${values[i]})` : ''}`}
              >
                {i < step ? <Icon name="check" size={15} /> : i + 1}
              </button>
              <span className="stepper__label">{values[i] ?? label}</span>
            </li>
          )
        })}
      </ol>

      {step === 0 && (
        <BrandStep
          onPick={(b) => {
            setBrand(b)
            setModel(null)
            setStep(1)
          }}
          onManual={(b, modelName) => {
            setBrand(b)
            setModel({ id: null, name: modelName, years: ALL_YEARS })
            setStep(2)
          }}
        />
      )}
      {step === 1 && brand && (
        <ModelStep
          brand={brand}
          onBack={() => setStep(0)}
          onPick={(m) => {
            setModel(m)
            setStep(2)
          }}
        />
      )}
      {step === 2 && brand && model && (
        <YearStep
          model={model}
          onBack={() => setStep(brand.id ? 1 : 0)}
          onPick={(y) => {
            setYear(y)
            setStep(3)
          }}
        />
      )}
      {step === 3 && brand && model && year !== null && (
        <EngineStep brand={brand} model={model} year={year} saving={saving} onPick={(e) => void finish(e)} onBack={() => setStep(2)} />
      )}
    </section>
  )
}

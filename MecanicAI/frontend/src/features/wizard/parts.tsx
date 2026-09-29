import { useState, type FormEvent } from 'react'

import { Icon } from '../../components/Icon.tsx'
import { Wheel } from '../../components/Wheel.tsx'

export function StepHead({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?(): void }) {
  return (
    <div className="step-head">
      {onBack && (
        <button type="button" className="icon-btn" onClick={onBack} aria-label="Volver al paso anterior">
          <Icon name="back" />
        </button>
      )}
      <div>
        <h2 className="step-title">{title}</h2>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
    </div>
  )
}

export function SearchInput({ value, onChange, label }: { value: string; onChange(v: string): void; label: string }) {
  return (
    <label className="search">
      <Icon name="search" size={18} />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={label}
        aria-label={label}
        autoComplete="off"
        enterKeyHint="search"
      />
    </label>
  )
}

export function Loading({ text }: { text: string }) {
  return (
    <div className="loading-row" aria-busy="true">
      <Wheel size={36} spinning />
      <span className="muted">{text}</span>
    </div>
  )
}

export function LoadError({ onRetry }: { onRetry(): void }) {
  return (
    <div className="notice notice--error">
      <Icon name="alert" size={20} />
      <span>No se pudo cargar la lista.</span>
      <button type="button" className="link-btn" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  )
}

/** Formulario para escribir la marca y/o el modelo cuando no están en el catálogo. */
export function ManualCarForm({
  askBrand,
  onSubmit,
  onCancel,
}: {
  askBrand: boolean
  onSubmit(brand: string, model: string): void
  onCancel(): void
}) {
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const valid = (!askBrand || brand.trim().length > 0) && model.trim().length > 0

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (valid) onSubmit(brand.trim(), model.trim())
  }

  return (
    <form className="manual-form" onSubmit={submit}>
      {askBrand && (
        <label className="field">
          <span className="field__label">Marca</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} autoFocus required />
        </label>
      )}
      <label className="field">
        <span className="field__label">Modelo</span>
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          maxLength={80}
          autoFocus={!askBrand}
          required
        />
      </label>
      <div className="row">
        <button type="submit" className="btn btn--primary" disabled={!valid}>
          Continuar
        </button>
        <button type="button" className="btn btn--ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

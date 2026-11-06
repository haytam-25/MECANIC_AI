import { useId, useState, type FormEvent } from 'react'

import { Icon } from '../../components/Icon.tsx'
import { CUSTOM_SUGGESTIONS, MAX_SECTION_TITLE } from './documents.ts'

/** Botón para crear una sección propia; al pulsarlo, una etiqueta de cinta para escribir su nombre. */
export function NewSection({ onCreate }: { onCreate(title: string): Promise<boolean> }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  if (!open) {
    return (
      <button type="button" className="btn btn--ghost btn--block doc-new" onClick={() => setOpen(true)}>
        <Icon name="plus" size={20} /> Añadir otra sección
      </button>
    )
  }

  const close = () => {
    setOpen(false)
    setTitle('')
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const name = title.trim()
    if (!name || busy) return
    setBusy(true)
    const created = await onCreate(name)
    setBusy(false)
    if (created) close()
  }

  return (
    <form className="plate doc-new-form" onSubmit={(event) => void submit(event)}>
      <label className="doc-new-form__label" htmlFor={id}>
        ¿Qué papel quieres guardar?
      </label>
      <span className="doc-tape doc-tape--big">
        <input
          id={id}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_SECTION_TITLE}
          placeholder="Ej.: Ficha técnica"
          autoComplete="off"
          autoFocus
          onKeyDown={(event) => event.key === 'Escape' && close()}
        />
      </span>
      <div className="chip-row doc-new-form__ideas">
        {CUSTOM_SUGGESTIONS.map((idea) => (
          <button key={idea} type="button" className="chip chip--button" onClick={() => setTitle(idea)}>
            {idea}
          </button>
        ))}
      </div>
      <div className="row doc-new-form__actions">
        <button type="submit" className="btn btn--primary" disabled={!title.trim() || busy} aria-busy={busy}>
          <Icon name="folder" size={18} /> Crear sección
        </button>
        <button type="button" className="btn btn--ghost" onClick={close}>
          Cancelar
        </button>
      </div>
    </form>
  )
}

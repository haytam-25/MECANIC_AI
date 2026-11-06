import { useState, type CSSProperties, type DragEvent, type FormEvent } from 'react'

import { documentFileUrl } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { DocumentFile, DocumentKind, DocumentSection } from '../../api/types.ts'
import { ConfirmRow } from '../../components/ConfirmRow.tsx'
import { Icon } from '../../components/Icon.tsx'
import { useToast } from '../../context/toast.ts'
import { isPdf, KIND_INFO, MAX_SECTION_TITLE, prepareUpload, type FixedKind } from './documents.ts'
import { ExpiryPanel, ExpiryStamp } from './ExpiryPanel.tsx'
import type { DocumentsApi } from './useDocuments.ts'

interface DocFolderProps {
  vehicleId: string
  kind: DocumentKind
  /** null: sección fija que aún no se ha usado (se crea al subir algo o poner la fecha). */
  section: DocumentSection | null
  index: number
  email: string | null
  docs: DocumentsApi
  onOpenPhoto(file: DocumentFile): void
}

interface Upload {
  id: string
  name: string
  progress: number
}

const errorMessage = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback)

/** Una carpeta de la documentación: su pestaña de color, la caducidad (ITV y seguro) y sus fotos o PDF. */
export function DocFolder({ vehicleId, kind, section, index, email, docs, onOpenPhoto }: DocFolderProps) {
  const toast = useToast()
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const fixed = kind === 'CUSTOM' ? null : KIND_INFO[kind]
  const files = section?.files ?? []
  const target = () => section ?? docs.ensure(vehicleId, kind as FixedKind)

  const uploadFiles = async (list: File[]) => {
    for (const file of list) {
      const id = `${Date.now()}-${Math.random()}`
      setUploads((current) => [...current, { id, name: file.name, progress: 0 }])
      const setProgress = (progress: number) =>
        setUploads((current) => current.map((u) => (u.id === id ? { ...u, progress } : u)))
      try {
        const prepared = await prepareUpload(file)
        const into = await target()
        await docs.upload(into.id, prepared.blob, prepared.name, setProgress)
      } catch (error) {
        toast(errorMessage(error, 'No se pudo subir el archivo. Inténtalo de nuevo.'), 'error')
        // Lleno: el resto tampoco cabría
        if (error instanceof ApiError && error.code === 'DOCUMENT_LIMIT') break
      } finally {
        setUploads((current) => current.filter((u) => u.id !== id))
      }
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const dropped = [...event.dataTransfer.files]
    if (dropped.length > 0) void uploadFiles(dropped)
  }

  const removeFile = async (file: DocumentFile) => {
    if (!section) return
    try {
      await docs.removeFile(section.id, file.id)
      toast('Documento borrado', 'success')
    } catch (error) {
      toast(errorMessage(error, 'No se pudo borrar el documento.'), 'error')
    }
  }

  const removeSection = async () => {
    if (!section) return
    try {
      await docs.removeSection(section.id)
      toast('Sección borrada', 'success')
    } catch (error) {
      toast(errorMessage(error, 'No se pudo borrar la sección.'), 'error')
      setConfirmingDelete(false)
    }
  }

  const tone = kind.toLowerCase()
  const headingId = `doc-${section?.id ?? kind}`

  return (
    <article
      className={`plate doc-folder doc-folder--${tone} ${dragging ? 'doc-folder--drag' : ''}`}
      style={{ '--i': index } as CSSProperties}
      aria-labelledby={headingId}
      onDragOver={(event) => {
        if (![...event.dataTransfer.types].includes('Files')) return
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false)
      }}
      onDrop={onDrop}
    >
      <span className="doc-folder__tab" aria-hidden="true">
        <Icon name={fixed?.icon ?? 'tag'} size={14} />
        {fixed?.tab ?? 'Mi sección'}
      </span>

      <header className="doc-folder__head">
        {fixed ? (
          <div className="doc-folder__titles">
            <h2 className="doc-folder__title" id={headingId}>
              {fixed.title} <span className="doc-folder__alt">/ {fixed.alt}</span>
            </h2>
            <p className="doc-folder__note">{fixed.note}</p>
          </div>
        ) : renaming && section ? (
          <RenameForm
            initial={section.title ?? ''}
            onCancel={() => setRenaming(false)}
            onSave={async (title) => {
              try {
                await docs.update(section.id, { title, expiresOn: null, reminder: false })
                setRenaming(false)
              } catch (error) {
                toast(errorMessage(error, 'No se pudo cambiar el nombre.'), 'error')
              }
            }}
          />
        ) : (
          <div className="doc-folder__titles">
            <h2 className="doc-folder__title doc-folder__title--tape" id={headingId}>
              <span>{section?.title}</span>
            </h2>
          </div>
        )}

        {fixed?.expires && section?.expiresOn && (
          <ExpiryStamp key={section.expiresOn} iso={section.expiresOn} verb={fixed.verb} />
        )}
        {!fixed && !renaming && (
          <div className="doc-folder__tools">
            <button type="button" className="icon-btn icon-btn--sm" aria-label="Cambiar el nombre" onClick={() => setRenaming(true)}>
              <Icon name="edit" size={17} />
            </button>
            <button
              type="button"
              className="icon-btn icon-btn--sm icon-btn--danger"
              aria-label="Borrar la sección"
              onClick={() => setConfirmingDelete(true)}
            >
              <Icon name="trash" size={17} />
            </button>
          </div>
        )}
      </header>

      {confirmingDelete && (
        <ConfirmRow
          text={
            files.length > 0
              ? `¿Borrar la sección y ${files.length === 1 ? 'su documento' : `sus ${files.length} documentos`}?`
              : '¿Borrar esta sección?'
          }
          onYes={() => void removeSection()}
          onNo={() => setConfirmingDelete(false)}
        />
      )}

      {fixed?.expires && (
        <ExpiryPanel
          section={section}
          verb={fixed.verb}
          email={email}
          onSave={async (changes) => {
            const into = await target()
            await docs.update(into.id, { title: null, ...changes })
          }}
        />
      )}

      <ul className="doc-sheets">
        {files.map((file, i) => (
          <FileSheet key={file.id} file={file} index={i} onOpen={() => onOpenPhoto(file)} onDelete={() => void removeFile(file)} />
        ))}
        {uploads.map((upload) => (
          <li key={upload.id} className="doc-sheet doc-sheet--uploading" aria-live="polite">
            <span className="doc-progress" style={{ '--p': upload.progress } as CSSProperties}>
              <span>{Math.round(upload.progress * 100)}%</span>
            </span>
            <span className="doc-sheet__name">{upload.name}</span>
          </li>
        ))}
        <li className="doc-sheet doc-sheet--add">
          <label className="doc-add">
            <input
              type="file"
              className="doc-visually-hidden"
              accept="image/*,application/pdf"
              multiple
              onChange={(event) => {
                const chosen = [...(event.target.files ?? [])]
                event.target.value = ''
                if (chosen.length > 0) void uploadFiles(chosen)
              }}
            />
            <span className="doc-add__icon">
              <Icon name="upload" size={24} />
            </span>
            <span className="doc-add__text">{files.length === 0 ? 'Sube una foto o PDF' : 'Añadir otro'}</span>
          </label>
        </li>
      </ul>

      {dragging && (
        <div className="doc-folder__drop" aria-hidden="true">
          <Icon name="upload" size={28} /> Suelta aquí para guardarlo
        </div>
      )}
    </article>
  )
}

function FileSheet({ file, index, onOpen, onDelete }: { file: DocumentFile; index: number; onOpen(): void; onDelete(): void }) {
  const [confirming, setConfirming] = useState(false)
  const url = documentFileUrl(file.id)
  const pdf = isPdf(file.contentType)
  return (
    <li className={`doc-sheet ${pdf ? 'doc-sheet--pdf' : 'doc-sheet--photo'}`} style={{ '--i': index } as CSSProperties}>
      {pdf ? (
        <a className="doc-sheet__paper" href={url} target="_blank" rel="noopener" aria-label={`Abrir ${file.name}`}>
          <span className="doc-sheet__pdf">PDF</span>
          <span className="doc-sheet__lines" aria-hidden="true" />
        </a>
      ) : (
        <button type="button" className="doc-sheet__paper" onClick={onOpen} aria-label={`Ver ${file.name}`}>
          <img src={url} alt="" loading="lazy" decoding="async" />
        </button>
      )}
      <span className="doc-sheet__name" title={file.name}>
        {file.name}
      </span>
      {confirming ? (
        <span className="doc-sheet__confirm">
          <span>¿Borrar?</span>
          <button type="button" className="btn btn--danger btn--xs" onClick={onDelete}>
            Sí
          </button>
          <button type="button" className="btn btn--ghost btn--xs" onClick={() => setConfirming(false)}>
            No
          </button>
        </span>
      ) : (
        <button type="button" className="doc-sheet__remove" aria-label={`Borrar ${file.name}`} onClick={() => setConfirming(true)}>
          <Icon name="close" size={14} />
        </button>
      )}
    </li>
  )
}

function RenameForm({ initial, onSave, onCancel }: { initial: string; onSave(title: string): Promise<void>; onCancel(): void }) {
  const [title, setTitle] = useState(initial)
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    await onSave(title.trim())
    setBusy(false)
  }
  return (
    <form className="doc-rename" onSubmit={(event) => void submit(event)}>
      <span className="doc-tape">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_SECTION_TITLE}
          aria-label="Nombre de la sección"
          autoFocus
          onKeyDown={(event) => event.key === 'Escape' && onCancel()}
        />
      </span>
      <button type="submit" className="icon-btn icon-btn--sm" aria-label="Guardar el nombre" disabled={!title.trim() || busy}>
        <Icon name="check" size={18} />
      </button>
      <button type="button" className="icon-btn icon-btn--sm" aria-label="Cancelar" onClick={onCancel}>
        <Icon name="close" size={18} />
      </button>
    </form>
  )
}

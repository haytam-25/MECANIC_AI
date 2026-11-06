import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

import { documentFileUrl } from '../../api/endpoints.ts'
import type { DocumentFile } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'

/** Foto a pantalla completa. Se cierra con Escape, con la X o tocando fuera. */
export function Lightbox({ file, onClose }: { file: DocumentFile; onClose(): void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const url = documentFileUrl(file.id)

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      previousFocus?.focus()
    }
  }, [onClose])

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={file.name} onClick={onClose}>
      <figure className="lightbox__figure" onClick={(event) => event.stopPropagation()}>
        <img src={url} alt={file.name} />
        <figcaption className="lightbox__bar">
          <span className="lightbox__name">{file.name}</span>
          <a className="btn btn--ghost btn--xs" href={url} target="_blank" rel="noopener">
            <Icon name="external" size={15} /> Abrir
          </a>
          <button ref={closeRef} type="button" className="icon-btn icon-btn--sm" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </figcaption>
      </figure>
    </div>,
    document.body,
  )
}

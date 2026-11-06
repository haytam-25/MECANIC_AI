import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createDocumentSection,
  deleteDocumentFile,
  deleteDocumentSection,
  fetchDocuments,
  updateDocumentSection,
  uploadDocumentFile,
} from '../../api/endpoints.ts'
import type { DocumentFile, DocumentSection, DocumentSectionUpdate } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'
import type { FixedKind } from './documents.ts'

const byCreation = (a: DocumentSection, b: DocumentSection) => a.createdAt.localeCompare(b.createdAt)

/**
 * Documentación de todos los coches (null mientras se carga). Solo con cuenta: como invitado no hay nada guardado y
 * la lista está vacía.
 */
export function useDocuments() {
  const { me } = useSession()
  const authenticated = Boolean(me?.authenticated)
  const [sections, setSections] = useState<DocumentSection[] | null>(null)
  /** Secciones fijas que se están creando (así dos acciones seguidas no la piden dos veces). */
  const creating = useRef(new Map<string, Promise<DocumentSection>>())

  useEffect(() => {
    if (!authenticated) return
    let active = true
    fetchDocuments()
      .then((list) => {
        if (active) setSections(list)
      })
      .catch(() => {
        if (active) setSections([])
      })
    return () => {
      active = false
    }
  }, [authenticated])

  const put = useCallback((section: DocumentSection) => {
    setSections((list) => [...(list ?? []).filter((s) => s.id !== section.id), section].sort(byCreation))
  }, [])

  const patchFiles = useCallback((sectionId: string, change: (files: DocumentFile[]) => DocumentFile[]) => {
    setSections((list) => (list ?? []).map((s) => (s.id === sectionId ? { ...s, files: change(s.files) } : s)))
  }, [])

  /** La sección fija de un coche, creándola en el servidor la primera vez que se usa. */
  const ensure = useCallback(
    async (vehicleId: string, kind: FixedKind): Promise<DocumentSection> => {
      const key = `${vehicleId}:${kind}`
      let pending = creating.current.get(key)
      if (!pending) {
        pending = createDocumentSection(vehicleId, kind)
        creating.current.set(key, pending)
        const forget = () => creating.current.delete(key)
        pending.then(forget, forget)
      }
      const section = await pending
      put(section)
      return section
    },
    [put],
  )

  const addSection = useCallback(
    async (vehicleId: string, title: string) => {
      const section = await createDocumentSection(vehicleId, 'CUSTOM', title)
      put(section)
      return section
    },
    [put],
  )

  const update = useCallback(
    async (sectionId: string, changes: DocumentSectionUpdate) => {
      const section = await updateDocumentSection(sectionId, changes)
      put(section)
      return section
    },
    [put],
  )

  const removeSection = useCallback(async (sectionId: string) => {
    await deleteDocumentSection(sectionId)
    setSections((list) => (list ?? []).filter((s) => s.id !== sectionId))
  }, [])

  const upload = useCallback(
    async (sectionId: string, blob: Blob, name: string, onProgress?: (fraction: number) => void) => {
      const file = await uploadDocumentFile(sectionId, blob, name, onProgress)
      patchFiles(sectionId, (files) => [...files, file])
      return file
    },
    [patchFiles],
  )

  const removeFile = useCallback(
    async (sectionId: string, fileId: string) => {
      await deleteDocumentFile(fileId)
      patchFiles(sectionId, (files) => files.filter((f) => f.id !== fileId))
    },
    [patchFiles],
  )

  return {
    sections: authenticated ? sections : ([] as DocumentSection[]),
    ensure,
    addSection,
    update,
    removeSection,
    upload,
    removeFile,
  }
}

export type DocumentsApi = ReturnType<typeof useDocuments>

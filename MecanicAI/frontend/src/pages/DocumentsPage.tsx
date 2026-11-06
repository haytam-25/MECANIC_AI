import { useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router'

import { ApiError } from '../api/http.ts'
import type { DocumentFile } from '../api/types.ts'
import { Icon } from '../components/Icon.tsx'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { DocFolder } from '../features/documents/DocFolder.tsx'
import { FIXED_KINDS } from '../features/documents/documents.ts'
import { ExpiryDials } from '../features/documents/ExpiryDials.tsx'
import { GuestDocuments } from '../features/documents/GuestDocuments.tsx'
import { Lightbox } from '../features/documents/Lightbox.tsx'
import { NewSection } from '../features/documents/NewSection.tsx'
import { useDocuments } from '../features/documents/useDocuments.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { carPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import '../features/documents/documents.css'
import './pages.css'

/**
 * Documentación de un coche: permiso de circulación, ITV, seguro y las secciones que cree el usuario, con sus fotos o
 * PDF y el aviso por email de caducidad. Solo con cuenta; los invitados ven la invitación a iniciar sesión.
 */
export function DocumentsPage() {
  const { me } = useSession()
  const vehicle = useGarageVehicle()
  const docs = useDocuments()
  const toast = useToast()
  const [photo, setPhoto] = useState<DocumentFile | null>(null)
  const closePhoto = useCallback(() => setPhoto(null), [])

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />

  const sections = docs.sections
  const mine = sections?.filter((s) => s.vehicleId === vehicle.id) ?? []
  const custom = mine.filter((s) => s.kind === 'CUSTOM')
  const email = me.user?.email ?? null

  const createSection = async (title: string) => {
    try {
      await docs.addSection(vehicle.id, title)
      return true
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo crear la sección.', 'error')
      return false
    }
  }

  return (
    <div className="page page--enter docs-page">
      <header className="page-head">
        <p className="eyebrow">Documentación</p>
        <h1 className="page-title">Papeles del coche</h1>
        <p className="doc-tagline">todo en regla y siempre a mano</p>
      </header>

      <CarPlate
        vehicle={vehicle}
        action={
          <Link to={carPath(vehicle.id)} className="btn btn--ghost btn--xs">
            <Icon name="back" size={16} /> Volver
          </Link>
        }
      />

      {!me.authenticated ? (
        <GuestDocuments />
      ) : sections === null ? (
        <div className="center-block" aria-busy="true">
          <Wheel size={56} spinning title="Cargando la documentación" />
        </div>
      ) : (
        <>
          <ExpiryDials sections={sections} vehicleId={vehicle.id} />

          <div className="doc-folders">
            {FIXED_KINDS.map((kind, i) => (
              <DocFolder
                key={kind}
                vehicleId={vehicle.id}
                kind={kind}
                section={mine.find((s) => s.kind === kind) ?? null}
                index={i}
                email={email}
                docs={docs}
                onOpenPhoto={setPhoto}
              />
            ))}
            {custom.map((section, i) => (
              <DocFolder
                key={section.id}
                vehicleId={vehicle.id}
                kind="CUSTOM"
                section={section}
                index={FIXED_KINDS.length + i}
                email={email}
                docs={docs}
                onOpenPhoto={setPhoto}
              />
            ))}
          </div>

          <NewSection onCreate={createSection} />

          <p className="doc-footnote small muted">
            <Icon name="lock" size={14} /> Solo tú puedes ver tus documentos. Fotos (JPG, PNG o WebP) o PDF de hasta 5 MB.
          </p>
        </>
      )}

      {photo && <Lightbox file={photo} onClose={closePhoto} />}
    </div>
  )
}

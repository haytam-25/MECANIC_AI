import { LoginOptions } from '../../components/LoginOptions.tsx'
import { useSession } from '../../context/session.ts'
import './garage.css'

/** Recomendación de iniciar sesión: como invitado, el garaje se pierde al cerrar la página. */
export function GuestSaveCard({ compact = false }: { compact?: boolean }) {
  const { me } = useSession()
  if (!me || me.authenticated) return null
  return (
    <section className={`guest-save ${compact ? 'guest-save--compact' : 'plate'}`}>
      <h2 className="guest-save__title">Guarda tus coches</h2>
      <p className="muted small">
        En modo invitado tus coches, consultas y reparaciones <strong>se borran al cerrar la página</strong>. Inicia sesión con Google
        para tenerlos siempre en tu garaje, en cualquier dispositivo, y hasta {me.features.freeDailyMessages} mensajes al
        día.
      </p>
      <LoginOptions />
    </section>
  )
}

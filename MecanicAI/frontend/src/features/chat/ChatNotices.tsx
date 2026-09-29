import { Icon } from '../../components/Icon.tsx'
import { LoginOptions } from '../../components/LoginOptions.tsx'
import type { Usage } from '../../api/types.ts'

export function DemoBanner() {
  return (
    <div className="notice notice--demo">
      <Icon name="wrench" size={18} />
      <span>
        <strong>Modo demo:</strong> la IA no está configurada (falta <code>GEMINI_API_KEY</code>), las respuestas son de
        ejemplo.
      </span>
    </div>
  )
}

export function GuestLimitCard({ freeDailyMessages }: { freeDailyMessages: number }) {
  return (
    <section className="limit-card plate">
      <h2 className="limit-card__title">Has usado tus consultas gratis de hoy</h2>
      <p className="muted">
        Inicia sesión con Google para seguir: <strong>{freeDailyMessages} mensajes al día</strong>, tu garaje y el historial
        de consultas guardados. Esta conversación se guardará en tu cuenta.
      </p>
      <LoginOptions />
    </section>
  )
}

export function UserLimitCard({ usage }: { usage: Usage }) {
  return (
    <section className="limit-card plate">
      <h2 className="limit-card__title">Has llegado al límite de hoy</h2>
      <p className="muted">
        Tus {usage.limit} mensajes diarios se renuevan a las 00:00. Muy pronto habrá un plan Pro con más mensajes y una IA
        más potente.
      </p>
    </section>
  )
}

export function UsageLine({ usage, guest }: { usage: Usage; guest: boolean }) {
  return (
    <span className="usage-line">
      {guest ? 'Invitado · ' : ''}
      {usage.remaining === 1 ? 'Te queda 1 mensaje' : `Te quedan ${usage.remaining} de ${usage.limit} mensajes`} hoy ·
      La IA puede equivocarse: ante dudas de seguridad, acude a un taller.
    </span>
  )
}

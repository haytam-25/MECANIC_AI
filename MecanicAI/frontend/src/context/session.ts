import { createContext, useContext } from 'react'

import type { ConversationSummary, Me, Usage, Vehicle } from '../api/types.ts'

export interface SessionValue {
  /** null mientras se carga la primera vez. */
  me: Me | null
  /** No se pudo contactar con el servidor. */
  offline: boolean
  conversations: ConversationSummary[]
  vehicles: Vehicle[]
  refreshMe(): Promise<Me | null>
  refreshLists(): Promise<void>
  setUsage(usage: Usage): void
  /** Eligió "Modo Invitado" en la portada (se recuerda en este navegador hasta que cierra sesión). */
  guestMode: boolean
  enterGuestMode(): void
  loginWithGoogle(): void
  /** Tras iniciar sesión: guarda en la cuenta la consulta de invitado y devuelve a dónde ir. */
  completeLogin(): Promise<string | null>
  logout(): Promise<void>
  removeAccount(): Promise<void>
}

export const SessionContext = createContext<SessionValue | null>(null)

/** Usuario actual, su uso diario, su garaje y su historial de consultas. */
export function useSession(): SessionValue {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSession debe usarse dentro de <SessionProvider>')
  return session
}

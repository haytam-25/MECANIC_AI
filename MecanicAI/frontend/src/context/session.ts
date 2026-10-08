import { createContext, useContext } from 'react'

import type { ConversationSummary, Me, Usage, Vehicle, VehicleSpec } from '../api/types.ts'
import type { GuestConversation } from '../lib/guestGarage.ts'

export interface SessionValue {
  /** null mientras se carga la primera vez. */
  me: Me | null
  /** No se pudo contactar con el servidor. */
  offline: boolean
  /** Historial de consultas de todos los coches (como invitado, las de esta pestaña). */
  conversations: ConversationSummary[]
  /** Garaje: con cuenta, el guardado en el servidor; como invitado, el de esta pestaña. */
  vehicles: Vehicle[]
  refreshMe(): Promise<Me | null>
  refreshLists(): Promise<void>
  /** Guarda el coche en el garaje (si ya estaba, devuelve el mismo). */
  addVehicle(spec: VehicleSpec): Promise<Vehicle>
  /** Borra el coche y sus consultas. */
  removeVehicle(id: string): Promise<void>
  removeConversation(id: string): Promise<void>
  /** Consulta de invitado con sus mensajes. */
  guestConversation(id: string): GuestConversation | undefined
  /** Crea o actualiza una consulta de invitado. */
  saveGuestConversation(conversation: GuestConversation): void
  setUsage(usage: Usage): void
  /** Informes médicos de esta semana. */
  setReportUsage(usage: Usage): void
  /** Eligió "Modo Invitado" en la portada (se recuerda en este navegador hasta que cierra sesión). */
  guestMode: boolean
  enterGuestMode(): void
  loginWithGoogle(): void
  /**
   * Tras iniciar sesión: guarda en la cuenta el garaje del invitado. Devuelve a dónde ir y cuántos coches no cabían
   * en el garaje de la cuenta.
   */
  completeLogin(): Promise<{ path: string | null; skipped: number }>
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

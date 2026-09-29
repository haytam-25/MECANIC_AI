import type { ChatMessage, VehicleSpec } from '../api/types.ts'

/**
 * Consulta del modo invitado. Solo vive en este navegador (localStorage); al iniciar sesión se
 * guarda en la cuenta y se borra de aquí.
 */
export interface GuestChat {
  vehicle: VehicleSpec
  messages: ChatMessage[]
}

const KEY = 'mecanicai.invitado'

export function loadGuestChat(): GuestChat | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as Partial<GuestChat>
    if (!data.vehicle?.brand || !data.vehicle.model) return null
    const messages = Array.isArray(data.messages)
      ? data.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      : []
    return { vehicle: data.vehicle, messages }
  } catch {
    return null
  }
}

export function saveGuestChat(chat: GuestChat | null): void {
  try {
    if (chat) localStorage.setItem(KEY, JSON.stringify(chat))
    else localStorage.removeItem(KEY)
  } catch {
    // Almacenamiento no disponible (modo privado): la consulta solo dura mientras la página esté abierta
  }
}

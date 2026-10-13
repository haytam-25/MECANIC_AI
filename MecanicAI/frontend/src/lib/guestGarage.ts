import type {
  BasketItem,
  ChatMessage,
  ConversationSummary,
  Repair,
  RepairInput,
  Vehicle,
  VehicleSpec,
} from '../api/types.ts'
import { displayName, engineLabel, toSpec } from './vehicle.ts'

/**
 * Garaje del modo invitado: sus coches, sus consultas, su diario de reparaciones y su cesta. Vive en sessionStorage,
 * así que dura mientras la pestaña esté abierta (también al recargar o al volver del inicio de sesión con Google, que es cuando se guarda en la
 * cuenta) y se pierde al cerrarla.
 */
export interface GuestConversation {
  id: string
  vehicleId: string
  title: string
  updatedAt: string
  messages: ChatMessage[]
}

export interface GuestGarage {
  /** El más reciente primero, como el garaje de la cuenta. */
  vehicles: Vehicle[]
  conversations: GuestConversation[]
  /** Diario de reparaciones, de la más reciente a la más antigua. */
  repairs: Repair[]
  /** Cesta de la compra, en el orden en que se añadió cada artículo. */
  basket: BasketItem[]
}

export const EMPTY_GUEST_GARAGE: GuestGarage = { vehicles: [], conversations: [], repairs: [], basket: [] }

const KEY = 'mecanicai.garaje-invitado'

export function loadGuestGarage(): GuestGarage {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return EMPTY_GUEST_GARAGE
    const data = JSON.parse(raw) as Partial<GuestGarage>
    const vehicles = Array.isArray(data.vehicles) ? data.vehicles.filter((v) => v?.id && v.brand && v.model) : []
    const ids = new Set(vehicles.map((v) => v.id))
    const conversations = Array.isArray(data.conversations)
      ? data.conversations
          .filter((c) => c?.id && ids.has(c.vehicleId) && Array.isArray(c.messages))
          .map((c) => ({
            ...c,
            messages: c.messages.filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'),
          }))
      : []
    const repairs = Array.isArray(data.repairs)
      ? data.repairs.filter(
          (r) => r?.id && ids.has(r.vehicleId) && typeof r.date === 'string' && Number.isFinite(r.km) && Array.isArray(r.types),
        )
      : []
    const basket = Array.isArray(data.basket)
      ? data.basket.filter((b) => b?.id && ids.has(b.vehicleId) && typeof b.text === 'string')
      : []
    return { vehicles, conversations, repairs, basket }
  } catch {
    return EMPTY_GUEST_GARAGE
  }
}

export function saveGuestGarage(garage: GuestGarage): void {
  try {
    if (garage.vehicles.length > 0) sessionStorage.setItem(KEY, JSON.stringify(garage))
    else sessionStorage.removeItem(KEY)
  } catch {
    // Almacenamiento no disponible (modo privado): el garaje solo dura mientras la página esté abierta
  }
}

// Sin crypto.randomUUID: solo existe en HTTPS y en desarrollo se prueba desde el móvil por http
function localId(): string {
  return `local-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

/** Coche del garaje de invitado, con la misma forma que uno de la cuenta. */
export function newGuestVehicle(spec: VehicleSpec): Vehicle {
  return { ...toSpec(spec), id: localId(), displayName: displayName(spec), engineLabel: engineLabel(spec) }
}

/** Consulta nueva de invitado; el título sale de la primera pregunta, igual que en el servidor. */
export function newGuestConversation(vehicleId: string, firstQuestion: string): GuestConversation {
  const clean = firstQuestion.trim().replace(/\s+/g, ' ')
  const title = clean.length <= 60 ? clean : `${clean.slice(0, 59).trim()}…`
  return { id: localId(), vehicleId, title, updatedAt: new Date().toISOString(), messages: [] }
}

/** Reparación nueva de invitado, con la misma forma que una de la cuenta. */
export function newGuestRepair(input: RepairInput): Repair {
  return { ...input, id: localId(), createdAt: new Date().toISOString() }
}

/** Artículo nuevo de la cesta de invitado, con la misma forma que uno de la cuenta. */
export function newGuestBasketItem(vehicleId: string, text: string): BasketItem {
  return { id: localId(), vehicleId, text, createdAt: new Date().toISOString() }
}

export function guestSummary(conversation: GuestConversation, vehicle: Vehicle): ConversationSummary {
  return { id: conversation.id, title: conversation.title, vehicle, updatedAt: conversation.updatedAt }
}

/** La consulta con una pregunta nueva: pasa a ser la más reciente. */
export function withQuestion(conversation: GuestConversation, messages: ChatMessage[]): GuestConversation {
  return { ...conversation, messages, updatedAt: new Date().toISOString() }
}

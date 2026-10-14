import { toAiSpec, vehicleKey } from '../lib/vehicle.ts'
import { api } from './http.ts'
import { postStream, type OnDelta } from './sse.ts'
import type {
  BasketItem,
  Brand,
  CarModel,
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  EngineSuggestions,
  MaintenancePlan,
  Me,
  Repair,
  RepairInput,
  ReportInput,
  ReportResult,
  SavedReport,
  StreamDone,
  Vehicle,
  VehicleSpec,
} from './types.ts'

// El catálogo casi no cambia: se guarda en memoria mientras la app está abierta
const catalogCache = new Map<string, Promise<unknown>>()

function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  let promise = catalogCache.get(key) as Promise<T> | undefined
  if (!promise) {
    promise = load()
    catalogCache.set(key, promise)
    promise.catch(() => catalogCache.delete(key))
  }
  return promise
}

const toTurns = (messages: ChatMessage[]) => messages.map(({ role, content }) => ({ role, content }))

// Sesión
export const fetchMe = () => api<Me>('/api/auth/me')
export const logout = () => api<void>('/api/auth/logout', { method: 'POST' })
export const deleteAccount = () => api<void>('/api/auth/account', { method: 'DELETE' })

// Catálogo
export const fetchBrands = () => cached('brands', () => api<Brand[]>('/api/catalog/brands'))
export const fetchModels = (brandId: string) =>
  cached(`models:${brandId}`, () => api<CarModel[]>(`/api/catalog/brands/${encodeURIComponent(brandId)}/models`))
// Las motorizaciones tardan varios segundos en llegar de la IA: si el usuario vuelve atrás y entra otra vez en el
// mismo coche se reutiliza la consulta (en curso o terminada) en vez de empezar otra. No admite AbortSignal a
// propósito: la consulta es compartida y no debe cortarse porque un paso del asistente se desmonte.
const engineCache = new Map<string, Promise<EngineSuggestions>>()

export function fetchEngines(brandId: string, modelId: string, year: number): Promise<EngineSuggestions> {
  const key = `${brandId}/${modelId}/${year}`
  let promise = engineCache.get(key)
  if (!promise) {
    const loading = api<EngineSuggestions>(
      `/api/catalog/engines?brand=${encodeURIComponent(brandId)}&model=${encodeURIComponent(modelId)}&year=${year}`,
    )
    engineCache.set(key, loading)
    // Si la IA no respondió (lista vacía o error), la próxima vez se vuelve a preguntar
    loading.then(
      (result) => result.engines.length === 0 && engineCache.delete(key),
      () => engineCache.delete(key),
    )
    promise = loading
  }
  return promise
}

// Informe médico: el plan de mantenimiento de cada coche solo se pide una vez mientras la app está abierta
// (salvo si la IA no respondió: entonces se vuelve a intentar la próxima vez)
const planCache = new Map<string, MaintenancePlan>()

export async function fetchMaintenancePlan(vehicle: VehicleSpec): Promise<MaintenancePlan> {
  const key = vehicleKey(vehicle)
  const known = planCache.get(key)
  if (known) return known
  const plan = await api<MaintenancePlan>('/api/maintenance/plan', { method: 'POST', body: toAiSpec(vehicle) })
  if (plan.source === 'ai' || plan.source === 'cache') planCache.set(key, plan)
  return plan
}

// Informes guardados (con cuenta) y límite semanal de informes (con cuenta y como invitado)
export const fetchReports = () => api<SavedReport[]>('/api/reports')
export const saveReport = (vehicleId: string, input: ReportInput) =>
  api<ReportResult>('/api/reports', { method: 'POST', body: { vehicleId, input } })
export const countGuestReport = () => api<ReportResult>('/api/guest/reports', { method: 'POST' })

// Historial de reparaciones (solo con cuenta: el de invitado no sale del navegador)
export const fetchRepairs = () => api<Repair[]>('/api/repairs')
export const createRepair = (input: RepairInput) => api<Repair>('/api/repairs', { method: 'POST', body: input })
export const updateRepair = (id: string, input: RepairInput) =>
  api<Repair>(`/api/repairs/${id}`, { method: 'PUT', body: input })
export const deleteRepair = (id: string) => api<void>(`/api/repairs/${id}`, { method: 'DELETE' })

// Cesta de la compra (solo con cuenta: la de invitado no sale del navegador)
export const fetchBasket = () => api<BasketItem[]>('/api/basket')
export const addBasketItem = (vehicleId: string, text: string) =>
  api<BasketItem>('/api/basket', { method: 'POST', body: { vehicleId, text } })
/** Lo comprado sale de la cesta. */
export const removeBoughtItems = (ids: string[]) => api<void>('/api/basket/bought', { method: 'POST', body: { ids } })

// Garaje
export const fetchVehicles = () => api<Vehicle[]>('/api/vehicles')
export const createVehicle = (spec: VehicleSpec) => api<Vehicle>('/api/vehicles', { method: 'POST', body: spec })
export const deleteVehicle = (id: string) => api<void>(`/api/vehicles/${id}`, { method: 'DELETE' })

// Conversaciones
export const fetchConversations = () => api<ConversationSummary[]>('/api/conversations')
export const fetchConversation = (id: string) => api<ConversationDetail>(`/api/conversations/${id}`)
export const createConversation = (vehicleId: string) =>
  api<ConversationSummary>('/api/conversations', { method: 'POST', body: { vehicleId } })
export const deleteConversation = (id: string) => api<void>(`/api/conversations/${id}`, { method: 'DELETE' })
export const importConversation = (vehicle: VehicleSpec, messages: ChatMessage[]) =>
  api<ConversationSummary>('/api/conversations/import', {
    method: 'POST',
    body: { vehicle, messages: toTurns(messages) },
  })

// Chat en streaming
export const streamMessage = (conversationId: string, content: string, onDelta: OnDelta, signal: AbortSignal) =>
  postStream(`/api/conversations/${conversationId}/messages`, { content }, onDelta, signal)
export const streamRetry = (conversationId: string, onDelta: OnDelta, signal: AbortSignal) =>
  postStream(`/api/conversations/${conversationId}/retry`, undefined, onDelta, signal)
export const streamGuest = (
  vehicle: VehicleSpec,
  history: ChatMessage[],
  message: string,
  onDelta: OnDelta,
  signal: AbortSignal,
): Promise<StreamDone> =>
  postStream('/api/guest/chat', { vehicle: toAiSpec(vehicle), history: toTurns(history), message }, onDelta, signal)

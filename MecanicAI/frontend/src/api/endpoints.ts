import { api } from './http.ts'
import { postStream, type OnDelta } from './sse.ts'
import type {
  Brand,
  CarModel,
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  EngineSuggestions,
  Me,
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
export const fetchEngines = (brandId: string, modelId: string, year: number, signal?: AbortSignal) =>
  api<EngineSuggestions>(
    `/api/catalog/engines?brand=${encodeURIComponent(brandId)}&model=${encodeURIComponent(modelId)}&year=${year}`,
    { signal },
  )

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
): Promise<StreamDone> => postStream('/api/guest/chat', { vehicle, history: toTurns(history), message }, onDelta, signal)

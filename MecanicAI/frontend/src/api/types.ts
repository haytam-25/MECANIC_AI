// Tipos de la API del backend (Spring Boot)

export type Fuel = 'GASOLINA' | 'DIESEL' | 'HIBRIDO' | 'HIBRIDO_ENCHUFABLE' | 'ELECTRICO' | 'GLP' | 'GNC'

export interface Usage {
  used: number
  limit: number
  remaining: number
  resetsAt: string
}

export interface User {
  id: string
  name: string | null
  email: string
  avatarUrl: string | null
  plan: 'FREE' | 'PRO'
}

export interface Features {
  googleLogin: boolean
  aiDemo: boolean
  guestDailyMessages: number
  freeDailyMessages: number
}

export interface Me {
  authenticated: boolean
  user: User | null
  usage: Usage
  features: Features
}

export interface Brand {
  id: string
  name: string
  abbr: string
  popular: boolean
}

export interface CarModel {
  id: string
  name: string
  years: number[]
  yearsLabel: string
}

export interface EngineOption {
  name: string
  fuel: Fuel | null
  powerCv: number | null
  /** Código de motor (BMW, Volkswagen y Audi), p. ej. "M57" o "BKD". */
  code?: string | null
}

export interface EngineSuggestions {
  engines: EngineOption[]
  source: 'cache' | 'ai' | 'demo' | 'limited' | 'unavailable'
}

/** Coche elegido en el asistente. Los ids son null si se escribió a mano. */
export interface VehicleSpec {
  brandId: string | null
  brand: string
  modelId: string | null
  model: string
  year: number
  engine: string | null
  fuel: Fuel | null
  powerCv: number | null
}

export interface Vehicle extends VehicleSpec {
  id: string
  displayName: string
  engineLabel: string | null
}

export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id?: number | string
  role: Role
  content: string
}

export interface ConversationSummary {
  id: string
  title: string
  vehicle: Vehicle
  updatedAt: string
}

export interface ConversationDetail {
  id: string
  title: string
  vehicle: Vehicle
  messages: ChatMessage[]
}

export interface ApiErrorBody {
  code: string
  message: string
  usage?: Usage
}

/** Evento final de una respuesta en streaming. */
export interface StreamDone {
  messageId?: number
  conversationId?: string
  title?: string
  usage: Usage
}

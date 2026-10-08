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
  guestWeeklyReports: number
  freeWeeklyReports: number
  /** Coches como mucho en el garaje. */
  maxVehicles: number
  /** Consultas guardadas como mucho: al empezar una más se borra la más antigua. */
  maxConversations: number
}

export interface Me {
  authenticated: boolean
  user: User | null
  /** Mensajes de hoy. */
  usage: Usage
  /** Informes médicos de esta semana. */
  reports: Usage
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

/** Distribución del motor según la IA (DESCONOCIDA: se le pregunta al usuario). */
export type Timing = 'CORREA' | 'CORREA_EN_ACEITE' | 'CADENA' | 'NINGUNA' | 'DESCONOCIDA'

/** Elemento del informe médico. Sin intervalos (cadena de distribución) no tiene cambio programado. */
export interface PlanItem {
  id: string
  name: string
  description: string
  intervalKm: number | null
  intervalMonths: number | null
  /** Aviso concreto de este motor o modelo (de la IA). */
  note: string | null
  /** Afecta a la seguridad o puede romper el motor. */
  critical: boolean
  /** Poco importante (filtro de habitáculo, escobillas): se cambia cada 4 años y no alarma en el diagnóstico. */
  minor: boolean
}

export interface MaintenancePlan {
  timing: Timing
  timingNote: string | null
  items: PlanItem[]
  /** limited / unavailable / demo: intervalos habituales, no los de ese coche. */
  source: 'cache' | 'ai' | 'demo' | 'limited' | 'unavailable'
}

export type AnswerKind = 'known' | 'never' | 'unknown'
export type TimeUnit = 'meses' | 'años'

/** Respuesta del formulario del informe para un elemento (los números tal cual los escribe el usuario). */
export interface ItemAnswer {
  kind: AnswerKind
  km: string
  time: string
  unit: TimeUnit
}

/** Solo se pregunta si la IA no sabe si el motor lleva correa o cadena. */
export type TimingAnswer = 'CORREA' | 'CADENA' | 'NO_SE'

export interface ReportInput {
  currentKm: string
  timing: TimingAnswer | null
  answers: Record<string, ItemAnswer>
}

/** Último informe médico de un coche del garaje (solo cuentas de Google). */
export interface SavedReport {
  vehicleId: string
  input: ReportInput
  savedAt: string
}

export interface ReportResult {
  /** null para los invitados: su informe no se guarda. */
  report: SavedReport | null
  /** Informes de esta semana. */
  usage: Usage
}

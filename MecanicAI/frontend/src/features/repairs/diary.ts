/**
 * Diario de reparaciones: tipos de trabajo que se pueden apuntar en cada coche, y cómo se leen y se escriben los
 * datos del formulario (fecha, km, precio).
 */
import type { Fuel, MaintenancePlan, PlanItem, Repair } from '../../api/types.ts'
import { formatKm, intervalText, parseKm } from '../report/health.ts'

export interface RepairType {
  id: string
  label: string
  /** Cada cuánto se cambia (solo los elementos de mantenimiento). */
  hint?: string | null
}

/** Nombres de los elementos de mantenimiento si no se pudo cargar el plan del coche (los mismos que el servidor). */
const MAINTENANCE_LABELS: Record<string, string> = {
  ACEITE: 'Aceite y filtro de aceite',
  FILTRO_AIRE: 'Filtro de aire',
  FILTRO_HABITACULO: 'Filtro de habitáculo (polen)',
  FILTRO_COMBUSTIBLE: 'Filtro de combustible',
  BUJIAS: 'Bujías',
  DISTRIBUCION: 'Distribución',
  CORREA_ACCESORIOS: 'Correa de accesorios',
  LIQUIDO_FRENOS: 'Líquido de frenos',
  PASTILLAS_FRENO: 'Pastillas de freno',
  DISCOS_FRENO: 'Discos de freno',
  NEUMATICOS: 'Neumáticos',
  REFRIGERANTE: 'Líquido refrigerante',
  BATERIA: 'Batería de 12 V',
  AMORTIGUADORES: 'Amortiguadores',
  ESCOBILLAS: 'Escobillas del limpiaparabrisas',
}

/** Averías y otros trabajos (RepairCategory en el servidor). `combustion`: solo en coches con motor de combustión. */
const OTHER_TYPES: (RepairType & { combustion?: boolean })[] = [
  { id: 'REVISION', label: 'Revisión general' },
  { id: 'ITV', label: 'ITV' },
  { id: 'MOTOR', label: 'Avería de motor' },
  { id: 'EMBRAGUE', label: 'Embrague', combustion: true },
  { id: 'CAJA_CAMBIOS', label: 'Caja de cambios' },
  { id: 'ELECTRICIDAD', label: 'Electricidad y electrónica' },
  { id: 'AIRE_ACONDICIONADO', label: 'Aire acondicionado' },
  { id: 'ESCAPE', label: 'Escape, catalizador o FAP', combustion: true },
  { id: 'ALINEADO', label: 'Alineado y equilibrado' },
  { id: 'CARROCERIA', label: 'Carrocería y lunas' },
  { id: 'OTRO', label: 'Otro' },
]

const OTHER_LABELS: Record<string, string> = Object.fromEntries(OTHER_TYPES.map((t) => [t.id, t.label]))

/** Con correa o cadena conocida, la distribución se llama por su nombre. */
function maintenanceLabel(plan: MaintenancePlan | null, item: PlanItem): string {
  if (item.id !== 'DISTRIBUCION' || !plan) return item.name
  if (plan.timing === 'CORREA' || plan.timing === 'CORREA_EN_ACEITE') return 'Correa de distribución'
  if (plan.timing === 'CADENA') return 'Cadena de distribución'
  return item.name
}

/**
 * Lo que se puede apuntar en este coche: su mantenimiento (el de su plan, que depende del motor y del combustible) y
 * las averías habituales. Sin plan (no se pudo cargar) se ofrece todo el mantenimiento.
 */
export function repairTypes(plan: MaintenancePlan | null, fuel: Fuel | null): { maintenance: RepairType[]; other: RepairType[] } {
  const maintenance = plan
    ? plan.items.map((item) => ({ id: item.id, label: maintenanceLabel(plan, item), hint: intervalText(item) }))
    : Object.entries(MAINTENANCE_LABELS).map(([id, label]) => ({ id, label }))
  const other = OTHER_TYPES.filter((t) => !(t.combustion && fuel === 'ELECTRICO')).map(({ id, label }) => ({ id, label }))
  return { maintenance, other }
}

export function typeLabel(id: string, plan: MaintenancePlan | null = null): string {
  const item = plan?.items.find((i) => i.id === id)
  if (item) return maintenanceLabel(plan, item)
  return MAINTENANCE_LABELS[id] ?? OTHER_LABELS[id] ?? id
}

/** De la más reciente a la más antigua (a igual fecha, la última apuntada primero). */
export function sortRepairs(repairs: Repair[]): Repair[] {
  return [...repairs].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Fecha local "2026-10-09" (la de <input type="date">). */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** La fecha "2026-10-09" movida unos días ("2026-10-08" con -1). */
export function addDays(iso: string, days: number): string {
  const date = fromIso(iso)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** "9 oct 2026" */
export function formatDate(iso: string): string {
  return fromIso(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
}

const euros = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })

/** 12950 → "129,50 €" */
export function formatPrice(cents: number): string {
  return euros.format(cents / 100)
}

const MAX_PRICE_CENTS = 10_000_000

/**
 * "129,50", "1.250", "1.250,99" o "45.5" → céntimos. undefined si está vacío (el precio es opcional) y null si no
 * es un precio válido.
 */
export function parsePrice(text: string): number | null | undefined {
  let clean = text.replace(/[\s€]/g, '')
  if (clean === '') return undefined
  if (clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.')
  else if (!/^\d+\.\d{1,2}$/.test(clean)) clean = clean.replace(/\./g, '')
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(clean)) return null
  const cents = Math.round(Number(clean) * 100)
  return cents <= MAX_PRICE_CENTS ? cents : null
}

/** Precio guardado en el formato en que lo escribiría el usuario ("129,5" → "129,50"). */
export function priceText(cents: number | null): string {
  if (cents === null) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

export const MAX_WORKSHOP = 80
export const MAX_NOTES = 1000

/** Lo que se escribe en el formulario, tal cual (se convierte al guardar). */
export interface RepairDraft {
  types: string[]
  date: string
  km: string
  price: string
  workshop: string
  notes: string
}

export type DraftErrors = Partial<Record<keyof RepairDraft, string>>

/** Errores del formulario por campo; `today`: fecha local de hoy. */
export function validateDraft(draft: RepairDraft, today: string): DraftErrors {
  const errors: DraftErrors = {}
  if (draft.types.length === 0) errors.types = 'Elige al menos una cosa que se le hizo.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) errors.date = 'Indica la fecha de la reparación.'
  else if (draft.date > today) errors.date = 'La fecha no puede ser futura.'
  else if (draft.date < '1950-01-01') errors.date = 'Revisa la fecha.'
  if (parseKm(draft.km) === null) errors.km = 'Escribe los kilómetros que tenía el coche (ej.: 125000).'
  if (parsePrice(draft.price) === null) errors.price = 'El precio debe ser un número (ej.: 129,90).'
  if (draft.workshop.trim().length > MAX_WORKSHOP) errors.workshop = `Como mucho ${MAX_WORKSHOP} caracteres.`
  if (draft.notes.trim().length > MAX_NOTES) errors.notes = `Como mucho ${MAX_NOTES} caracteres.`
  return errors
}

/** Cuándo toca volver a cambiar un elemento de mantenimiento hecho en esta reparación ("135.000 km o oct 2027"). */
export function nextChange(item: PlanItem, repair: Repair): string | null {
  const parts: string[] = []
  if (item.intervalKm) parts.push(formatKm(repair.km + item.intervalKm))
  if (item.intervalMonths) {
    const date = fromIso(repair.date)
    date.setMonth(date.getMonth() + item.intervalMonths)
    parts.push(date.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' }))
  }
  if (parts.length === 0) return null
  return parts.length === 2 ? `a los ${parts[0]} o en ${parts[1]} (lo que llegue antes)` : parts[0].endsWith('km') ? `a los ${parts[0]}` : `en ${parts[0]}`
}

/** Id de la última reparación de cada tipo (solo la última dice cuándo toca el próximo cambio). */
export function latestByType(repairs: Repair[]): Map<string, string> {
  const latest = new Map<string, string>()
  for (const repair of sortRepairs(repairs)) {
    for (const type of repair.types) if (!latest.has(type)) latest.set(type, repair.id)
  }
  return latest
}

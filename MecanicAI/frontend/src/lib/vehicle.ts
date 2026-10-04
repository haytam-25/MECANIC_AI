import type { Fuel, VehicleSpec } from '../api/types.ts'

export const FUEL_LABELS: Record<Fuel, string> = {
  GASOLINA: 'Gasolina',
  DIESEL: 'Diésel',
  HIBRIDO: 'Híbrido',
  HIBRIDO_ENCHUFABLE: 'Híbrido enchufable',
  ELECTRICO: 'Eléctrico',
  GLP: 'GLP',
  GNC: 'GNC',
}

export const FUELS = Object.keys(FUEL_LABELS) as Fuel[]

/** "SEAT León (2016)" */
export function displayName(vehicle: VehicleSpec): string {
  return `${vehicle.brand} ${vehicle.model} (${vehicle.year})`
}

/** "1.6 TDI · 115 CV · Diésel", o null si no se conoce la motorización. */
export function engineLabel(vehicle: Pick<VehicleSpec, 'engine' | 'powerCv' | 'fuel'>): string | null {
  const parts: string[] = []
  if (vehicle.engine) parts.push(vehicle.engine)
  if (vehicle.powerCv) parts.push(`${vehicle.powerCv} CV`)
  if (vehicle.fuel) parts.push(FUEL_LABELS[vehicle.fuel])
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Solo los datos del coche (sin el id ni los textos de un coche del garaje). */
export function toSpec(vehicle: VehicleSpec): VehicleSpec {
  const { brandId, brand, modelId, model, year, engine, fuel, powerCv } = vehicle
  return { brandId, brand, modelId, model, year, engine, fuel, powerCv }
}

/** Identifica una versión de coche (mismos datos = mismo coche), sin distinguir mayúsculas ni espacios. */
export function vehicleKey(vehicle: VehicleSpec): string {
  const text = (value: string | null) => (value ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
  return [text(vehicle.brand), text(vehicle.model), vehicle.year, text(vehicle.engine), vehicle.fuel ?? '', vehicle.powerCv ?? ''].join('|')
}

/** Iniciales para el tapacubos: "Alfa Romeo" → "AR", "BMW" → "BMW", "Toyota" → "T". */
export function brandAbbr(name: string): string {
  const words = name.trim().split(/[\s/&-]+/).filter(Boolean)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.length <= 3 ? name.toUpperCase() : name.charAt(0).toUpperCase()
}

/** Minúsculas y sin tildes, para buscar ("citroen" encuentra "Citroën"). */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
}

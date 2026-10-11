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

/** Caracteres que se pueden escribir en el campo de la matrícula (con sus espacios o guiones). */
export const PLATE_MAX_LENGTH = 12

/** La matrícula tal y como se guarda, en mayúsculas y solo con letras y números: "1234 bcd" → "1234BCD". */
export function normalizePlate(raw: string): string | null {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '') || null
}

/** "1234 BCD" para las matrículas españolas actuales; las demás, tal cual se guardan. */
export function formatPlate(plate: string): string {
  return plate.replace(/^(\d{4})([A-Z]{3})$/, '$1 $2')
}

/** Solo los datos del coche (sin el id ni los textos de un coche del garaje). */
export function toSpec(vehicle: VehicleSpec): VehicleSpec {
  const { brandId, brand, modelId, model, year, engine, fuel, powerCv, plate } = vehicle
  // Los coches de invitado guardados antes de que existiera la matrícula no la traen
  return { brandId, brand, modelId, model, year, engine, fuel, powerCv, plate: plate ?? null }
}

/** Los datos del coche que hacen falta para consultar a la IA: la matrícula no sale del garaje. */
export function toAiSpec(vehicle: VehicleSpec): VehicleSpec {
  return { ...toSpec(vehicle), plate: null }
}

/**
 * Identifica una versión de coche (mismos datos = mismo coche), sin distinguir mayúsculas ni espacios. La matrícula
 * no cuenta: dos coches iguales comparten plan de mantenimiento.
 */
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

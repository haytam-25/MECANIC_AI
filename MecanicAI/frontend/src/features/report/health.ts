/**
 * Cálculo del "informe médico": compara lo que el usuario dice que se cambió con los intervalos del plan de
 * mantenimiento. Se calcula en el navegador; con cuenta, las respuestas del formulario se guardan en el servidor.
 */
import type { ItemAnswer, MaintenancePlan, PlanItem, ReportInput, TimeUnit, Usage, VehicleSpec } from '../../api/types.ts'

export type Status = 'urgent' | 'soon' | 'ok' | 'unknown' | 'info'

export interface ItemResult {
  item: PlanItem
  /** Nombre a mostrar (la distribución depende de la respuesta correa/cadena). */
  name: string
  status: Status
  /** Parte del intervalo ya consumida (1 = toca cambiarlo). */
  ratio: number | null
  message: string
  /** Calculado desde que el coche era nuevo. */
  sinceNew: boolean
}

export const TIMING_ID = 'DISTRIBUCION'

/** A partir de esta parte del intervalo consumida se avisa de que toca pronto. */
const SOON = 0.8

const MAX_KM = 2_000_000
const MAX_MONTHS = 100 * 12

export const emptyAnswer = (): ItemAnswer => ({ kind: 'known', km: '', time: '', unit: 'meses' })

/** "125.000" o "125 000" → 125000. null si está vacío o no es un número entero válido. */
export function parseKm(text: string): number | null {
  const clean = text.replace(/[.\s]/g, '')
  if (!/^\d{1,9}$/.test(clean)) return null
  const km = Number(clean)
  return km <= MAX_KM ? km : null
}

/** "1,5" años → 18 meses. null si está vacío o no es válido. */
export function parseMonths(text: string, unit: TimeUnit): number | null {
  const clean = text.trim().replace(',', '.')
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(clean)) return null
  const months = Math.round(Number(clean) * (unit === 'años' ? 12 : 1))
  return months <= MAX_MONTHS ? months : null
}

/** Edad aproximada del coche en meses, suponiendo que se matriculó a mitad de su año. */
export function carAgeMonths(year: number, now: Date): number {
  return Math.max(0, (now.getFullYear() - year) * 12 + now.getMonth() - 6)
}

/** "15.000 km" */
export function formatKm(km: number): string {
  return `${Math.round(km).toLocaleString('es-ES')} km`
}

/** "1 mes", "8 meses", "2 años", "1 año y medio" */
export function formatMonths(months: number): string {
  const m = Math.round(months)
  if (m < 12) return m === 1 ? '1 mes' : `${m} meses`
  if (m % 12 === 0) return m === 12 ? '1 año' : `${m / 12} años`
  if (m < 24) return m === 18 ? '1 año y medio' : `${m} meses`
  const halfYears = Math.round(m / 6) / 2
  return Number.isInteger(halfYears) ? `${halfYears} años` : `${Math.floor(halfYears)} años y medio`
}

/** "Cada 15.000 km o 1 año (lo que llegue antes)" */
export function intervalText(item: PlanItem): string | null {
  const parts = [
    item.intervalKm ? formatKm(item.intervalKm) : null,
    item.intervalMonths ? formatMonths(item.intervalMonths) : null,
  ].filter(Boolean)
  if (parts.length === 0) return null
  return parts.length === 2 ? `Cada ${parts[0]} o ${parts[1]} (lo que llegue antes)` : `Cada ${parts[0]}`
}

/** Si la distribución se pregunta y el usuario aún no ha dicho que es de correa, no se preguntan sus fechas. */
export function asksTimingType(plan: MaintenancePlan, item: PlanItem): boolean {
  return item.id === TIMING_ID && plan.timing === 'DESCONOCIDA'
}

/** Elementos con cambio programado por los que se pregunta en el formulario. */
export function isAskable(plan: MaintenancePlan, item: PlanItem, input: ReportInput): boolean {
  if (asksTimingType(plan, item)) return input.timing === 'CORREA'
  return item.intervalKm !== null || item.intervalMonths !== null
}

/** Errores del formulario por elemento ("currentKm" para el kilometraje). */
export function validate(plan: MaintenancePlan, input: ReportInput): Record<string, string> {
  const errors: Record<string, string> = {}
  const currentKm = parseKm(input.currentKm)
  if (currentKm === null) errors.currentKm = 'Escribe los kilómetros que marca el cuentakilómetros.'

  for (const item of plan.items) {
    const answer = input.answers[item.id]
    if (!answer || answer.kind !== 'known' || !isAskable(plan, item, input)) continue
    const hasKm = item.intervalKm !== null && answer.km.trim() !== ''
    const hasTime = item.intervalMonths !== null && answer.time.trim() !== ''
    if (!hasKm && !hasTime) continue // Sin datos: cuenta como "no lo sé"
    if (hasKm) {
      const km = parseKm(answer.km)
      if (km === null) errors[item.id] = 'Los kilómetros deben ser un número (ej.: 12000).'
      else if (currentKm !== null && km > currentKm) {
        errors[item.id] = `No puede ser más que los km que tiene el coche (${formatKm(currentKm)}).`
      }
    }
    if (hasTime && !errors[item.id] && parseMonths(answer.time, answer.unit) === null) {
      errors[item.id] = 'El tiempo debe ser un número (ej.: 8 meses o 1,5 años).'
    }
  }
  return errors
}

const CHAIN_MESSAGE =
  'No tiene cambio programado: dura lo que el motor si el aceite se cambia a tiempo. Revísala si oyes un ' +
  'traqueteo metálico al arrancar en frío.'

/** Meses completos entre dos fechas. */
export function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + to.getMonth() - from.getMonth()
  return Math.max(0, to.getDate() < from.getDate() ? months - 1 : months)
}

/**
 * `savedAt`: cuándo se rellenó el formulario. El tiempo que ha pasado desde entonces se suma a lo que dijo el
 * usuario ("hace 10 meses" rellenado hace 3 meses = hace 13 meses); los km no se pueden saber.
 */
export function evaluate(
  plan: MaintenancePlan,
  input: ReportInput,
  vehicle: VehicleSpec,
  savedAt: Date,
  now: Date,
): ItemResult[] {
  const currentKm = parseKm(input.currentKm)
  const elapsed = monthsBetween(savedAt, now)
  return plan.items.map((item) => {
    let name = item.name
    if (asksTimingType(plan, item)) {
      if (input.timing === 'CADENA') {
        return { item, name: 'Cadena de distribución', status: 'info', ratio: null, message: CHAIN_MESSAGE, sinceNew: false }
      }
      if (input.timing !== 'CORREA') {
        return {
          item,
          name,
          status: 'unknown',
          ratio: null,
          sinceNew: false,
          message:
            'Averigua si tu motor lleva correa o cadena (viene en el libro de mantenimiento o te lo dicen en el taller). ' +
            'Si es correa y no sabes cuándo se cambió, cámbiala por precaución: si se rompe, puede destrozar el motor.',
        }
      }
      name = 'Correa de distribución'
    }
    if (item.intervalKm === null && item.intervalMonths === null) {
      return { item, name, status: 'info', ratio: null, message: CHAIN_MESSAGE, sinceNew: false }
    }

    const answer = input.answers[item.id]
    let kmSince: number | null = null
    let monthsSince: number | null = null
    const sinceNew = answer?.kind === 'never'
    if (answer?.kind === 'never') {
      kmSince = currentKm
      monthsSince = carAgeMonths(vehicle.year, now)
    } else if (answer?.kind === 'known') {
      kmSince = item.intervalKm !== null ? parseKm(answer.km) : null
      const months = item.intervalMonths !== null ? parseMonths(answer.time, answer.unit) : null
      monthsSince = months !== null ? months + elapsed : null
    }

    const kmRatio = item.intervalKm && kmSince !== null ? kmSince / item.intervalKm : null
    const monthsRatio = item.intervalMonths && monthsSince !== null ? monthsSince / item.intervalMonths : null
    if (kmRatio === null && monthsRatio === null) {
      return { item, name, status: 'unknown', ratio: null, message: unknownMessage(item), sinceNew: false }
    }

    const ratio = Math.max(kmRatio ?? 0, monthsRatio ?? 0)
    const kmLeft = kmRatio !== null && item.intervalKm ? item.intervalKm - (kmSince ?? 0) : null
    const monthsLeft = monthsRatio !== null && item.intervalMonths ? item.intervalMonths - (monthsSince ?? 0) : null
    const status: Status = ratio >= 1 ? 'urgent' : ratio >= SOON ? 'soon' : 'ok'
    const message = status === 'urgent' ? overdueMessage(kmLeft, monthsLeft) : nextChangeMessage(kmLeft, monthsLeft)
    return { item, name, status, ratio, message, sinceNew }
  })
}

function unknownMessage(item: PlanItem): string {
  if (item.critical) {
    return 'Sin datos. Es importante: mira la última factura del taller o pide que te lo revisen.'
  }
  return 'Sin datos. Lo encontrarás en el libro de mantenimiento o en la última factura del taller.'
}

function overdueMessage(kmLeft: number | null, monthsLeft: number | null): string {
  const parts: string[] = []
  if (kmLeft !== null && kmLeft < 0) parts.push(formatKm(-kmLeft))
  if (monthsLeft !== null && monthsLeft < 0) parts.push(formatMonths(-monthsLeft))
  return parts.length > 0 ? `Toca cambiarlo: lleva ${parts.join(' y ')} de retraso.` : 'Toca cambiarlo ya.'
}

function nextChangeMessage(kmLeft: number | null, monthsLeft: number | null): string {
  const parts: string[] = []
  if (kmLeft !== null) parts.push(formatKm(kmLeft))
  if (monthsLeft !== null) parts.push(monthsLeft < 1 ? 'menos de un mes' : formatMonths(monthsLeft))
  const suffix = parts.length === 2 ? ' (lo que llegue antes)' : ''
  return `Próximo cambio en ${parts.join(' o ')}${suffix}.`
}

export interface Diagnosis {
  tone: Exclude<Status, 'info'>
  title: string
  text: string
  counts: Record<Status, number>
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

export function diagnose(results: ItemResult[]): Diagnosis {
  const counts: Record<Status, number> = { urgent: 0, soon: 0, ok: 0, unknown: 0, info: 0 }
  for (const r of results) counts[r.status]++
  const { urgent, soon, ok, unknown } = counts

  // Si lo único pendiente es poco importante (filtro de habitáculo, escobillas), no hace falta alarmar
  const onlyMinorUrgent = urgent > 0 && results.every((r) => r.status !== 'urgent' || r.item.minor)
  if (onlyMinorUrgent && soon === 0) {
    return {
      tone: 'soon',
      title: 'Pequeños cambios pendientes',
      text: `Nada grave: ${urgent} ${plural(urgent, 'cosa de poca importancia toca', 'cosas de poca importancia tocan')} cambiar cuando puedas.`,
      counts,
    }
  }
  if (urgent > 0 && !onlyMinorUrgent) {
    const safety = results.some((r) => r.status === 'urgent' && r.item.critical)
    return {
      tone: 'urgent',
      title: 'Necesita ser reparado',
      text:
        `${urgent} ${plural(urgent, 'elemento ya debería haberse cambiado', 'elementos ya deberían haberse cambiado')}` +
        (safety ? ', y alguno afecta a la seguridad o al motor.' : '.'),
      counts,
    }
  }
  if (soon > 0) {
    const minor = onlyMinorUrgent
      ? ` y ${urgent} ${plural(urgent, 'cosa de poca importancia ya toca', 'cosas de poca importancia ya tocan')}`
      : ''
    return {
      tone: 'soon',
      title: 'Revisión próxima',
      text: `Nada urgente, pero ${soon} ${plural(soon, 'elemento está', 'elementos están')} cerca de su cambio${minor}.`,
      counts,
    }
  }
  if (ok > 0) {
    return {
      tone: 'ok',
      title: 'Buena salud',
      text:
        unknown > 0
          ? `Lo que sabemos está al día. Faltan datos de ${unknown} ${plural(unknown, 'elemento', 'elementos')}.`
          : 'Todo el mantenimiento está al día.',
      counts,
    }
  }
  return {
    tone: 'unknown',
    title: 'Faltan datos',
    text: 'Sin fechas ni kilómetros no puedo valorar el mantenimiento. Mira la última factura del taller.',
    counts,
  }
}

/** Pregunta para el chat con lo más importante del informe. */
export function chatQuestion(results: ItemResult[], currentKm: string): string {
  const km = parseKm(currentKm)
  const intro = `He hecho el informe médico de mi coche${km !== null ? ` (tiene ${formatKm(km)})` : ''}.`
  const urgent = results.filter((r) => r.status === 'urgent')
  const soon = results.filter((r) => r.status === 'soon')
  if (urgent.length === 0 && soon.length === 0) {
    return `${intro} Todo sale al día. ¿Qué mantenimiento me tocará próximamente y qué debería vigilar en este modelo?`
  }
  // "aceite y filtro de aceite (lleva 1000 km de retraso)", "líquido de frenos (en 4 meses)"
  const detail = (r: ItemResult) =>
    r.message
      .replace(/^Toca cambiarlo: /, '')
      .replace(/^Próximo cambio /, '')
      .replace(/\.$/, '')
  const list = (items: ItemResult[]) => items.map((r) => `${r.name.toLowerCase()} (${detail(r)})`).join('; ')
  const lines = [intro]
  if (urgent.length > 0) lines.push(`Ya toca cambiar: ${list(urgent)}.`)
  if (soon.length > 0) lines.push(`Pronto: ${list(soon)}.`)
  lines.push('¿Qué priorizo, qué riesgo tiene esperar y cuánto puede costar aproximadamente en un taller?')
  return lines.join(' ')
}

/** "Te quedan 3 de 5 informes esta semana" */
export function quotaText(usage: Usage): string {
  if (usage.remaining === 0) return 'No te quedan informes esta semana'
  return usage.remaining === 1
    ? `Te queda 1 informe de ${usage.limit} esta semana`
    : `Te quedan ${usage.remaining} de ${usage.limit} informes esta semana`
}

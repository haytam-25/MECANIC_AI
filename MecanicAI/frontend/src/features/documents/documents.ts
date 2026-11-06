import { ApiError } from '../../api/http.ts'
import type { DocumentKind, DocumentSection } from '../../api/types.ts'
import type { IconName } from '../../components/Icon.tsx'

export type FixedKind = Exclude<DocumentKind, 'CUSTOM'>

export const FIXED_KINDS: FixedKind[] = ['CIRCULATION', 'INSPECTION', 'INSURANCE']

interface KindInfo {
  title: string
  /** Cómo se llama en otros países (va tras una barra). */
  alt: string
  /** Etiqueta de la pestaña de la carpeta. */
  tab: string
  /** Nota a mano bajo el título. */
  note: string
  icon: IconName
  /** Tiene fecha de caducidad y aviso por email. */
  expires: boolean
  /** "caduca" o "vence". */
  verb: string
}

export const KIND_INFO: Record<FixedKind, KindInfo> = {
  CIRCULATION: {
    title: 'Permiso de circulación',
    alt: 'Cédula',
    tab: 'Circulación',
    note: 'Siempre a mano, por si te paran',
    icon: 'idcard',
    expires: false,
    verb: 'caduca',
  },
  INSPECTION: {
    title: 'ITV',
    alt: 'VTV · RTO',
    tab: 'Inspección',
    note: 'La revisión técnica obligatoria',
    icon: 'inspect',
    expires: true,
    verb: 'caduca',
  },
  INSURANCE: {
    title: 'Seguro obligatorio',
    alt: 'Póliza',
    tab: 'Seguro',
    note: 'Sin él en vigor no se puede circular',
    icon: 'shield',
    expires: true,
    verb: 'vence',
  },
}

/** Ideas para las secciones propias. */
export const CUSTOM_SUGGESTIONS = ['Ficha técnica', 'Etiqueta DGT', 'Garantía', 'Factura de compra', 'Tarjeta de transporte']

export const MAX_SECTION_TITLE = 40

const DAY = 24 * 60 * 60 * 1000

function localDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function today(): Date {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

/** Hoy en formato AAAA-MM-DD (hora local), para los campos de fecha. */
export function todayIso(): string {
  const date = today()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Días que faltan (negativo si ya pasó). */
export function daysUntil(iso: string): number {
  return Math.round((localDate(iso).getTime() - today().getTime()) / DAY)
}

export type ExpiryStatus = 'ok' | 'soon' | 'expired'

/** "soon" desde dos meses antes, cuando empiezan los avisos por email. */
export function expiryStatus(iso: string): ExpiryStatus {
  if (daysUntil(iso) < 0) return 'expired'
  const limit = today()
  limit.setMonth(limit.getMonth() + 2)
  return localDate(iso) <= limit ? 'soon' : 'ok'
}

/** "caduca en 45 días", "vence mañana", "caducó hace 3 días"… */
export function countdown(iso: string, verb: string): string {
  const days = daysUntil(iso)
  if (days < 0) return `${verb === 'vence' ? 'venció' : 'caducó'} hace ${-days === 1 ? '1 día' : `${-days} días`}`
  if (days === 0) return `${verb} hoy`
  if (days === 1) return `${verb} mañana`
  return `${verb} en ${days} días`
}

/** 12·03·2027, como en un sello. */
export function stampDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}·${month}·${year}`
}

/** Fecha razonable para guardarla (el servidor admite del 2000 a dentro de 15 años). */
export function isSaneExpiry(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const year = Number(iso.slice(0, 4))
  return year >= 2000 && year <= new Date().getFullYear() + 15
}

/** Archivos de un coche entre todas sus secciones. */
export function countFiles(sections: DocumentSection[], vehicleId: string): number {
  return sections.filter((s) => s.vehicleId === vehicleId).reduce((sum, s) => sum + s.files.length, 0)
}

/** Lo próximo que caduca de un coche (ITV o seguro con fecha), para el resumen de su página. */
export function nextExpiry(sections: DocumentSection[], vehicleId: string): DocumentSection | null {
  return (
    sections
      .filter((s) => s.vehicleId === vehicleId && s.kind !== 'CUSTOM' && KIND_INFO[s.kind].expires && s.expiresOn)
      .sort((a, b) => (a.expiresOn ?? '').localeCompare(b.expiresOn ?? ''))[0] ?? null
  )
}

export const isPdf = (contentType: string) => contentType === 'application/pdf'

// ---------- Preparar el archivo antes de subirlo ----------

const MAX_BYTES = 5 * 1024 * 1024
/** Las fotos se reducen a este lado máximo: se leen bien y pesan unos cientos de kB. */
const MAX_SIDE = 2000
const JPEG_QUALITY = 0.85
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function baseName(name: string): string {
  const dot = name.lastIndexOf('.')
  return (dot > 0 ? name.slice(0, dot) : name).trim() || 'foto'
}

/** Vuelve a dibujar la foto en JPEG y más pequeña. De paso se pierden sus metadatos (como la ubicación GPS). */
async function shrinkImage(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return null
    // Las zonas transparentes (capturas en PNG) quedan en blanco y no en negro
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  } catch {
    // El navegador no sabe abrir ese formato (p. ej. HEIC fuera de Safari)
    return null
  }
}

/** Foto reducida o PDF tal cual, listo para subir; lanza un ApiError con el mensaje si no se puede. */
export async function prepareUpload(file: File): Promise<{ blob: Blob; name: string }> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    if (file.size > MAX_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE', 'El PDF pesa demasiado (máximo 5 MB).')
    return { blob: file, name: file.name }
  }
  if (!file.type.startsWith('image/')) {
    throw new ApiError(400, 'UNSUPPORTED_FILE', 'Solo se pueden guardar fotos o PDF.')
  }
  const shrunk = await shrinkImage(file)
  if (shrunk && shrunk.size <= MAX_BYTES) return { blob: shrunk, name: `${baseName(file.name)}.jpg` }
  if (IMAGE_TYPES.includes(file.type) && file.size <= MAX_BYTES) return { blob: file, name: file.name }
  throw new ApiError(400, 'UNSUPPORTED_FILE', 'No se pudo leer esa foto. Prueba con otra en JPG o PNG, o con un PDF.')
}

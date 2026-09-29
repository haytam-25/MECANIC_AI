const DAY = 24 * 60 * 60 * 1000

const shortDate = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' })

/** "hoy", "ayer", "hace 3 días" o "12 sept". */
export function relativeDay(iso: string): string {
  const date = new Date(iso)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const that = new Date(date)
  that.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - that.getTime()) / DAY)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'ayer'
  if (days < 7) return `hace ${days} días`
  return shortDate.format(date)
}

export function firstName(name: string | null | undefined): string {
  return name?.trim().split(/\s+/)[0] ?? ''
}

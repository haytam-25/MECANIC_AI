/** Datos que se van eligiendo en el asistente del coche. */

export const CURRENT_YEAR = new Date().getFullYear()

/** Todos los años seleccionables cuando el coche no está en el catálogo. */
export const ALL_YEARS = Array.from({ length: CURRENT_YEAR - 1970 + 1 }, (_, i) => CURRENT_YEAR - i)

export interface PickedBrand {
  id: string | null
  name: string
  abbr: string
}

export interface PickedModel {
  id: string | null
  name: string
  years: number[]
}

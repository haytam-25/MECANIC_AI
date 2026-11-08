import { lazy, type ComponentType } from 'react'

const RELOADED_AT = 'mecanicai.recarga-por-version'

/**
 * Página que se descarga al abrirla. Si su archivo ya no existe porque entretanto se publicó una versión nueva de la
 * app, se recarga una vez para traer la nueva; si vuelve a fallar (p. ej. sin conexión), el error lo muestra
 * PageErrorBoundary.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  return lazy(() =>
    load().then(
      (component) => ({ default: component }),
      (error: unknown) => {
        if (reloadOnce()) return new Promise<never>(() => {})
        throw error
      },
    ),
  )
}

/** Recarga la página salvo que ya se haya hecho por esto hace menos de un minuto. */
function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (Date.now() - last < 60_000) return false
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    // Sin almacenamiento no se puede saber si ya se recargó: mejor no arriesgarse a recargar sin fin
    return false
  }
  window.location.reload()
  return true
}

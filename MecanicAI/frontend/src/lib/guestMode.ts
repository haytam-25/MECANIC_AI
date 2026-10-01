/**
 * Si el visitante eligió "Modo Invitado" en la portada. Se recuerda en este navegador para no enseñarle la
 * portada cada vez que entra; al cerrar sesión se olvida y la portada vuelve a aparecer.
 */
const KEY = 'mecanicai.modo-invitado'

export function loadGuestMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveGuestMode(enabled: boolean): void {
  try {
    if (enabled) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // Almacenamiento no disponible (modo privado): la elección dura mientras la página esté abierta
  }
}

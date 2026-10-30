/**
 * Si el visitante eligió "Modo Invitado" en la portada. Vive en sessionStorage, como el garaje de invitado: dura
 * mientras la pestaña esté abierta (también al recargar) y al cerrarla se pierde, así que quien vuelve ve la portada.
 */
const KEY = 'mecanicai.modo-invitado'

export function loadGuestMode(): boolean {
  try {
    // Antes se guardaba en localStorage y sobrevivía a cerrar la pestaña: se borra lo que quede de entonces
    localStorage.removeItem(KEY)
  } catch {
    // Almacenamiento no disponible: no hay nada que borrar
  }
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export function saveGuestMode(enabled: boolean): void {
  try {
    if (enabled) sessionStorage.setItem(KEY, '1')
    else sessionStorage.removeItem(KEY)
  } catch {
    // Almacenamiento no disponible (modo privado): la elección dura mientras la página esté abierta
  }
}

import { useEffect, useState } from 'react'

/**
 * Lista guardada en la cuenta: null mientras se carga y vacía si no se pudo cargar. Solo se pide con la sesión
 * iniciada (como invitado sigue en null: cada hook usa el garaje de la pestaña). `load` debe ser siempre la misma
 * función, como las de api/endpoints.ts.
 */
export function useAccountList<T>(authenticated: boolean, load: () => Promise<T[]>) {
  const [list, setList] = useState<T[] | null>(null)

  useEffect(() => {
    if (!authenticated) return
    let active = true
    load()
      .then((items) => {
        if (active) setList(items)
      })
      .catch(() => {
        if (active) setList([])
      })
    return () => {
      active = false
    }
  }, [authenticated, load])

  return [list, setList] as const
}

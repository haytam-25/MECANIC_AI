import { useCallback, useEffect, useState } from 'react'

import { createRepair, deleteRepair, fetchRepairs, updateRepair } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { Repair, RepairInput } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'
import { newGuestRepair } from '../../lib/guestGarage.ts'
import { sortRepairs } from './diary.ts'

/** Mismo error que da el servidor cuando el diario está lleno. */
function diaryFull(max: number): ApiError {
  return new ApiError(
    409,
    'REPAIR_LIMIT',
    `Tu diario está lleno (máximo ${max} reparaciones entre todos tus coches). Borra alguna para apuntar otra.`,
  )
}

/**
 * Diario de reparaciones de todos los coches (null mientras se carga). Con cuenta se guarda en el servidor; como
 * invitado, en el garaje de esta pestaña.
 */
export function useRepairs() {
  const { me, guestRepairs, saveGuestRepair, removeGuestRepair } = useSession()
  const authenticated = Boolean(me?.authenticated)
  const max = me?.features.maxRepairs ?? 0
  const [account, setAccount] = useState<Repair[] | null>(null)

  useEffect(() => {
    if (!authenticated) return
    let active = true
    fetchRepairs()
      .then((list) => {
        if (active) setAccount(list)
      })
      .catch(() => {
        if (active) setAccount([])
      })
    return () => {
      active = false
    }
  }, [authenticated])

  const repairs = authenticated ? account : guestRepairs

  /** Apunta una reparación nueva o, con `id`, corrige esa. */
  const save = useCallback(
    async (input: RepairInput, id?: string): Promise<Repair> => {
      if (authenticated) {
        const saved = id ? await updateRepair(id, input) : await createRepair(input)
        setAccount((list) => sortRepairs([saved, ...(list ?? []).filter((r) => r.id !== saved.id)]))
        return saved
      }
      const existing = id ? guestRepairs.find((r) => r.id === id) : undefined
      if (!existing && max > 0 && guestRepairs.length >= max) throw diaryFull(max)
      const saved = existing ? { ...existing, ...input } : newGuestRepair(input)
      saveGuestRepair(saved)
      return saved
    },
    [authenticated, guestRepairs, max, saveGuestRepair],
  )

  const remove = useCallback(
    async (id: string) => {
      if (authenticated) {
        await deleteRepair(id)
        setAccount((list) => (list ?? []).filter((r) => r.id !== id))
        return
      }
      removeGuestRepair(id)
    },
    [authenticated, removeGuestRepair],
  )

  return { repairs, save, remove, max }
}

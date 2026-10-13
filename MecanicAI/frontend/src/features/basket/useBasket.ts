import { useCallback, useEffect, useState } from 'react'

import { addBasketItem, fetchBasket, removeBoughtItems } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { BasketItem } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'
import { newGuestBasketItem } from '../../lib/guestGarage.ts'

/** Como mucho, los caracteres de un artículo (los mismos que admite el servidor). */
export const MAX_BASKET_TEXT = 120

/** Una sola línea, sin espacios repetidos (igual que lo guarda el servidor). */
export function cleanBasketText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, MAX_BASKET_TEXT)
}

/** Mismo error que da el servidor cuando la cesta está llena. */
function basketFull(max: number): ApiError {
  return new ApiError(
    409,
    'BASKET_LIMIT',
    `Tu cesta está llena (máximo ${max} artículos entre todos tus coches). Marca alguno como comprado para añadir otro.`,
  )
}

/**
 * Cesta de la compra de todos los coches (null mientras se carga). Con cuenta se guarda en el servidor; como
 * invitado, en el garaje de esta pestaña.
 */
export function useBasket() {
  const { me, guestBasket, addGuestBasketItem, removeGuestBasketItems } = useSession()
  const authenticated = Boolean(me?.authenticated)
  const max = me?.features.maxBasketItems ?? 0
  const [account, setAccount] = useState<BasketItem[] | null>(null)

  useEffect(() => {
    if (!authenticated) return
    let active = true
    fetchBasket()
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

  const items = authenticated ? account : guestBasket

  /**
   * Añade un artículo a la cesta de un coche. `onSaved` se llama en el mismo instante en que el artículo entra en
   * `items` (la página lo usa para no contarlo hasta que termina su animación).
   */
  const add = useCallback(
    async (vehicleId: string, text: string, onSaved?: (item: BasketItem) => void): Promise<BasketItem> => {
      if (authenticated) {
        const saved = await addBasketItem(vehicleId, text)
        setAccount((list) => [...(list ?? []), saved])
        onSaved?.(saved)
        return saved
      }
      if (max > 0 && guestBasket.length >= max) throw basketFull(max)
      const saved = newGuestBasketItem(vehicleId, text)
      addGuestBasketItem(saved)
      onSaved?.(saved)
      return saved
    },
    [authenticated, guestBasket.length, max, addGuestBasketItem],
  )

  /** Saca de la cesta lo que ya se ha comprado. */
  const removeBought = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return
      if (authenticated) {
        await removeBoughtItems(ids)
        setAccount((list) => (list ?? []).filter((item) => !ids.includes(item.id)))
        return
      }
      removeGuestBasketItems(ids)
    },
    [authenticated, removeGuestBasketItems],
  )

  return { items, add, removeBought, max }
}

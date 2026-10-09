import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  createRepair,
  createVehicle,
  deleteAccount,
  deleteConversation,
  deleteVehicle,
  fetchConversations,
  fetchMe,
  fetchVehicles,
  importConversation,
  logout as apiLogout,
} from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import type { ConversationSummary, Me, Repair, Usage, Vehicle, VehicleSpec } from '../api/types.ts'
import { sortRepairs } from '../features/repairs/diary.ts'
import {
  EMPTY_GUEST_GARAGE,
  guestSummary,
  loadGuestGarage,
  newGuestVehicle,
  saveGuestGarage,
  type GuestConversation,
  type GuestGarage,
} from '../lib/guestGarage.ts'
import { loadGuestMode, saveGuestMode } from '../lib/guestMode.ts'
import { toSpec, vehicleKey } from '../lib/vehicle.ts'
import { SessionContext, type SessionValue } from './session.ts'

interface SessionData {
  me: Me
  conversations: ConversationSummary[]
  vehicles: Vehicle[]
}

/** Carga el usuario y, si ha iniciado sesión, su historial y su garaje. */
async function loadSession(): Promise<SessionData> {
  const me = await fetchMe()
  if (!me.authenticated) return { me, conversations: [], vehicles: [] }
  const [conversations, vehicles] = await Promise.all([fetchConversations(), fetchVehicles()])
  return { me, conversations, vehicles }
}

/** Mensajes que el servidor guarda como mucho de cada consulta de invitado (los últimos). */
const MAX_IMPORT_MESSAGES = 60

/** Mismo error que da el servidor cuando el garaje está lleno. */
function garageFull(max: number): ApiError {
  return new ApiError(409, 'VEHICLE_LIMIT', `Tu garaje está lleno (máximo ${max} coches). Borra uno para añadir otro.`)
}

interface ImportResult {
  newest: string | null
  /** Coches que no cabían en el garaje de la cuenta. */
  skipped: number
  /** Reparaciones que no cabían en el diario de la cuenta (o las de un coche que no cabía). */
  skippedRepairs: number
}

/**
 * Guarda en la cuenta el garaje del invitado: cada coche con sus consultas y sus reparaciones. Devuelve el id en la
 * cuenta del coche más reciente y lo que no cabía en la cuenta. Lo ya procesado se va quitando del garaje de
 * invitado para no duplicarlo si algo falla a mitad.
 */
async function importGuestGarage(garage: GuestGarage): Promise<ImportResult> {
  let pending = garage
  let newest: string | null = null
  let skipped = 0
  let skippedRepairs = 0
  let repairsFull = false
  // Del más antiguo al más reciente, para que en la cuenta queden en el mismo orden
  for (const vehicle of [...garage.vehicles].reverse()) {
    const chats = garage.conversations.filter((c) => c.vehicleId === vehicle.id && c.messages.length > 0).reverse()
    const repairs = sortRepairs(garage.repairs.filter((r) => r.vehicleId === vehicle.id)).reverse()
    let accountId: string | null = null
    try {
      if (chats.length === 0) {
        accountId = (await createVehicle(toSpec(vehicle))).id
      } else {
        for (const chat of chats) {
          accountId = (await importConversation(toSpec(vehicle), chat.messages.slice(-MAX_IMPORT_MESSAGES))).vehicle.id
        }
      }
      newest = accountId
    } catch (error) {
      // Garaje de la cuenta lleno: ese coche no cabe, pero el resto puede ser uno que ya tenía
      if (!(error instanceof ApiError && error.code === 'VEHICLE_LIMIT')) throw error
      skipped++
    }
    for (const repair of repairs) {
      if (!accountId || repairsFull) {
        skippedRepairs++
        continue
      }
      const { date, km, types, priceCents, workshop, notes } = repair
      try {
        await createRepair({ vehicleId: accountId, date, km, types, priceCents, workshop, notes })
      } catch (error) {
        if (!(error instanceof ApiError && (error.code === 'REPAIR_LIMIT' || error.code === 'VALIDATION'))) throw error
        repairsFull ||= error.code === 'REPAIR_LIMIT'
        skippedRepairs++
      }
    }
    pending = {
      vehicles: pending.vehicles.filter((v) => v.id !== vehicle.id),
      conversations: pending.conversations.filter((c) => c.vehicleId !== vehicle.id),
      repairs: pending.repairs.filter((r) => r.vehicleId !== vehicle.id),
    }
    saveGuestGarage(pending)
  }
  return { newest, skipped, skippedRepairs }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [offline, setOffline] = useState(false)
  const [accountConversations, setAccountConversations] = useState<ConversationSummary[]>([])
  const [accountVehicles, setAccountVehicles] = useState<Vehicle[]>([])
  const [guestGarage, setGuestGarage] = useState(loadGuestGarage)
  const [guestMode, setGuestMode] = useState(loadGuestMode)
  const authenticated = Boolean(me?.authenticated)

  useEffect(() => {
    saveGuestGarage(guestGarage)
  }, [guestGarage])

  // Se actualizan juntos: cuando la app ve al usuario, su garaje ya está cargado
  const apply = useCallback((data: SessionData) => {
    setAccountConversations(data.conversations)
    setAccountVehicles(data.vehicles)
    setMe(data.me)
    setOffline(false)
  }, [])

  useEffect(() => {
    let active = true
    loadSession()
      .then((data) => active && apply(data))
      .catch(() => active && setOffline(true))
    return () => {
      active = false
    }
  }, [apply])

  const refreshMe = useCallback(async () => {
    try {
      const data = await loadSession()
      apply(data)
      return data.me
    } catch {
      setOffline(true)
      return null
    }
  }, [apply])

  const refreshLists = useCallback(async () => {
    if (!authenticated) return
    const [convs, cars] = await Promise.all([fetchConversations(), fetchVehicles()])
    setAccountConversations(convs)
    setAccountVehicles(cars)
  }, [authenticated])

  const vehicles = authenticated ? accountVehicles : guestGarage.vehicles

  const conversations = useMemo(() => {
    if (authenticated) return accountConversations
    const byId = new Map(guestGarage.vehicles.map((v) => [v.id, v]))
    return guestGarage.conversations.flatMap((c) => {
      const vehicle = byId.get(c.vehicleId)
      return vehicle ? [guestSummary(c, vehicle)] : []
    })
  }, [authenticated, accountConversations, guestGarage])

  const addVehicle = useCallback(
    async (spec: VehicleSpec) => {
      if (authenticated) {
        const vehicle = await createVehicle(toSpec(spec))
        await refreshLists()
        return vehicle
      }
      const known = guestGarage.vehicles.find((v) => vehicleKey(v) === vehicleKey(spec))
      if (known) return known
      const max = me?.features.maxVehicles ?? 0
      if (max > 0 && guestGarage.vehicles.length >= max) throw garageFull(max)
      const vehicle = newGuestVehicle(spec)
      setGuestGarage((g) => ({ ...g, vehicles: [vehicle, ...g.vehicles] }))
      return vehicle
    },
    [authenticated, guestGarage.vehicles, me?.features.maxVehicles, refreshLists],
  )

  const removeVehicle = useCallback(
    async (id: string) => {
      if (authenticated) {
        await deleteVehicle(id)
        await refreshLists()
        return
      }
      setGuestGarage((g) => ({
        vehicles: g.vehicles.filter((v) => v.id !== id),
        conversations: g.conversations.filter((c) => c.vehicleId !== id),
        repairs: g.repairs.filter((r) => r.vehicleId !== id),
      }))
    },
    [authenticated, refreshLists],
  )

  const removeConversation = useCallback(
    async (id: string) => {
      if (authenticated) {
        await deleteConversation(id)
        await refreshLists()
        return
      }
      setGuestGarage((g) => ({ ...g, conversations: g.conversations.filter((c) => c.id !== id) }))
    },
    [authenticated, refreshLists],
  )

  const guestConversation = useCallback(
    (id: string) => guestGarage.conversations.find((c) => c.id === id),
    [guestGarage.conversations],
  )

  // La consulta tocada pasa a ser la primera (el historial va de la más reciente a la más antigua). Como en la
  // cuenta, se guardan como mucho maxConversations: al empezar una más se borra la más antigua.
  const maxConversations = me?.features.maxConversations ?? 0
  const saveGuestConversation = useCallback(
    (conversation: GuestConversation) => {
      setGuestGarage((g) => {
        const conversations = [conversation, ...g.conversations.filter((c) => c.id !== conversation.id)]
        return { ...g, conversations: maxConversations > 0 ? conversations.slice(0, maxConversations) : conversations }
      })
    },
    [maxConversations],
  )

  const saveGuestRepair = useCallback((repair: Repair) => {
    setGuestGarage((g) => ({ ...g, repairs: sortRepairs([repair, ...g.repairs.filter((r) => r.id !== repair.id)]) }))
  }, [])

  const removeGuestRepair = useCallback((id: string) => {
    setGuestGarage((g) => ({ ...g, repairs: g.repairs.filter((r) => r.id !== id) }))
  }, [])

  const setUsage = useCallback((usage: Usage) => {
    setMe((current) => (current ? { ...current, usage } : current))
  }, [])

  const setReportUsage = useCallback((reports: Usage) => {
    setMe((current) => (current ? { ...current, reports } : current))
  }, [])

  const enterGuestMode = useCallback(() => {
    saveGuestMode(true)
    setGuestMode(true)
  }, [])

  // Al salir de la cuenta se vuelve a la portada
  const leaveGuestMode = useCallback(() => {
    saveGuestMode(false)
    setGuestMode(false)
    setGuestGarage(EMPTY_GUEST_GARAGE)
  }, [])

  // El garaje de invitado sobrevive a la redirección de Google porque está en sessionStorage (misma pestaña)
  const loginWithGoogle = useCallback(() => {
    window.location.assign('/oauth2/authorization/google')
  }, [])

  const completeLogin = useCallback(async () => {
    const garage = loadGuestGarage()
    let path: string | null = null
    let skipped = 0
    let skippedRepairs = 0
    try {
      const imported = await importGuestGarage(garage)
      if (imported.newest) path = `/coche/${imported.newest}`
      skipped = imported.skipped
      skippedRepairs = imported.skippedRepairs
    } finally {
      setGuestGarage(loadGuestGarage())
      const [convs, cars] = await Promise.all([fetchConversations(), fetchVehicles()])
      setAccountConversations(convs)
      setAccountVehicles(cars)
    }
    return { path, skipped, skippedRepairs }
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    leaveGuestMode()
    await refreshMe()
  }, [refreshMe, leaveGuestMode])

  const removeAccount = useCallback(async () => {
    await deleteAccount()
    leaveGuestMode()
    await refreshMe()
  }, [refreshMe, leaveGuestMode])

  const value = useMemo<SessionValue>(
    () => ({
      me,
      offline,
      conversations,
      vehicles,
      refreshMe,
      refreshLists,
      addVehicle,
      removeVehicle,
      removeConversation,
      guestConversation,
      saveGuestConversation,
      guestRepairs: guestGarage.repairs,
      saveGuestRepair,
      removeGuestRepair,
      setUsage,
      setReportUsage,
      guestMode,
      enterGuestMode,
      loginWithGoogle,
      completeLogin,
      logout,
      removeAccount,
    }),
    [
      me,
      offline,
      conversations,
      vehicles,
      refreshMe,
      refreshLists,
      addVehicle,
      removeVehicle,
      removeConversation,
      guestConversation,
      saveGuestConversation,
      guestGarage.repairs,
      saveGuestRepair,
      removeGuestRepair,
      setUsage,
      setReportUsage,
      guestMode,
      enterGuestMode,
      loginWithGoogle,
      completeLogin,
      logout,
      removeAccount,
    ],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

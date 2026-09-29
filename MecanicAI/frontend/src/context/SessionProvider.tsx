import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import {
  createVehicle,
  deleteAccount,
  devLogin,
  fetchConversations,
  fetchMe,
  fetchVehicles,
  importConversation,
  logout as apiLogout,
} from '../api/endpoints.ts'
import type { ConversationSummary, Me, Usage, Vehicle } from '../api/types.ts'
import { loadGuestChat, saveGuestChat } from '../lib/guestChat.ts'
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

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [offline, setOffline] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])

  // Se actualizan juntos: cuando la app ve al usuario, su garaje ya está cargado
  const apply = useCallback((data: SessionData) => {
    setConversations(data.conversations)
    setVehicles(data.vehicles)
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
    const [convs, cars] = await Promise.all([fetchConversations(), fetchVehicles()])
    setConversations(convs)
    setVehicles(cars)
  }, [])

  const setUsage = useCallback((usage: Usage) => {
    setMe((current) => (current ? { ...current, usage } : current))
  }, [])

  const loginWithGoogle = useCallback(() => {
    window.location.assign('/oauth2/authorization/google')
  }, [])

  const loginAsDemo = useCallback(async () => {
    await devLogin()
    await refreshMe()
  }, [refreshMe])

  const completeLogin = useCallback(async () => {
    const guest = loadGuestChat()
    let path: string | null = null
    if (guest) {
      if (guest.messages.length > 0) {
        const conversation = await importConversation(guest.vehicle, guest.messages.slice(-200))
        path = `/chat/${conversation.id}`
      } else {
        const vehicle = await createVehicle(guest.vehicle)
        path = `/chat/nuevo?coche=${vehicle.id}`
      }
      saveGuestChat(null)
    }
    await refreshLists()
    return path
  }, [refreshLists])

  const logout = useCallback(async () => {
    await apiLogout()
    await refreshMe()
  }, [refreshMe])

  const removeAccount = useCallback(async () => {
    await deleteAccount()
    await refreshMe()
  }, [refreshMe])

  const value = useMemo<SessionValue>(
    () => ({
      me,
      offline,
      conversations,
      vehicles,
      refreshMe,
      refreshLists,
      setUsage,
      loginWithGoogle,
      loginAsDemo,
      completeLogin,
      logout,
      removeAccount,
    }),
    [me, offline, conversations, vehicles, refreshMe, refreshLists, setUsage, loginWithGoogle, loginAsDemo, completeLogin, logout, removeAccount],
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'

import { streamGuest } from '../api/endpoints.ts'
import type { ChatMessage } from '../api/types.ts'
import { useSession } from '../context/session.ts'
import { DemoBanner, GuestLimitCard, UsageLine } from '../features/chat/ChatNotices.tsx'
import { ChatView, type ChatFailure } from '../features/chat/ChatView.tsx'
import { chatPath, chatsPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { draftFromState } from '../lib/chatDraft.ts'
import { newGuestConversation, withQuestion, type GuestConversation } from '../lib/guestGarage.ts'
import { useStreamingReply } from '../lib/useStreamingReply.ts'

const GUEST_CONTEXT_MESSAGES = 20

/**
 * Chat de invitado: pocos mensajes al día y las consultas solo duran mientras la página esté abierta (al iniciar
 * sesión se guardan en la cuenta).
 */
export function GuestChatPage() {
  const { conversationId = 'nuevo' } = useParams()
  const { me, setUsage, guestConversation, saveGuestConversation, removeConversation } = useSession()
  const vehicle = useGarageVehicle()
  const location = useLocation()
  const navigate = useNavigate()
  const lookup = (id: string) => (id === 'nuevo' ? null : (guestConversation(id) ?? null))
  /** null hasta que se envía la primera pregunta (así no se guardan consultas vacías). */
  const [chat, setChat] = useState<GuestConversation | null>(() => lookup(conversationId))
  const [shownParam, setShownParam] = useState(conversationId)
  const [failure, setFailure] = useState<ChatFailure | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const reply = useStreamingReply()
  const chatRef = useRef(chat)

  // Se abrió otra consulta sin salir de la página. Si es la que se acaba de crear (la URL pasa de "nuevo" a su id)
  // no se toca, para no cortar la respuesta en curso.
  if (conversationId !== shownParam) {
    setShownParam(conversationId)
    if (conversationId !== chat?.id) {
      setChat(lookup(conversationId))
      setFailure(null)
    }
  }

  useEffect(() => {
    chatRef.current = chat
    if (chat) saveGuestConversation(chat)
  }, [chat, saveGuestConversation])

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />
  if (conversationId !== 'nuevo' && !chat) return <Navigate to={chatsPath(vehicle.id)} replace />

  const ask = async (history: ChatMessage[], text: string): Promise<boolean> => {
    if (reply.busy) return false
    const current = chatRef.current ?? newGuestConversation(vehicle.id, text)
    setFailure(null)
    const question: ChatMessage = { role: 'user', content: text }
    const asked = withQuestion(current, [...history, question])
    chatRef.current = asked
    setChat(asked)
    if (!current.messages.length && conversationId === 'nuevo') navigate(chatPath(vehicle.id, current.id), { replace: true })

    // El servidor solo usa los últimos mensajes como contexto
    const recent = history.slice(-GUEST_CONTEXT_MESSAGES)
    const result = await reply.run((onDelta, signal) => streamGuest(vehicle, recent, text, onDelta, signal))
    if (result.done) {
      setChat((c) => c && { ...c, messages: [...c.messages, { role: 'assistant', content: result.text }] })
      setUsage(result.done.usage)
      return true
    }
    if (result.aborted) {
      if (result.text.trim()) {
        setChat((c) => c && { ...c, messages: [...c.messages, { role: 'assistant', content: result.text }] })
      }
      return true
    }
    const error = result.error
    if (error?.code === 'QUOTA_EXCEEDED') {
      if (error.usage) setUsage(error.usage)
      setLimitReached(true)
      if (history.length === 0) {
        // Era su primera pregunta: la consulta no llega a existir
        chatRef.current = null
        setChat(null)
        void removeConversation(current.id)
        navigate(chatPath(vehicle.id, 'nuevo'), { replace: true })
      } else {
        setChat((c) => c && { ...c, messages: history })
      }
      return false
    }
    setFailure({
      message: error?.message ?? 'Algo ha fallado.',
      onRetry: () => void ask(history, text),
    })
    return true
  }

  const blocked = limitReached || me.usage.remaining <= 0

  return (
    <ChatView
      vehicle={vehicle}
      backTo={chatsPath(vehicle.id)}
      messages={chat?.messages ?? []}
      streamingText={reply.streamingText}
      failure={failure}
      banner={me.features.aiDemo ? <DemoBanner /> : undefined}
      notice={blocked ? <GuestLimitCard freeDailyMessages={me.features.freeDailyMessages} /> : undefined}
      inputDisabled={blocked}
      initialDraft={draftFromState(location.state)}
      footer={<UsageLine usage={me.usage} guest />}
      onSend={(text) => ask(chat?.messages ?? [], text)}
      onStop={reply.stop}
    />
  )
}

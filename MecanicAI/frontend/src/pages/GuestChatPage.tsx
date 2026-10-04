import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router'

import { streamGuest } from '../api/endpoints.ts'
import type { ChatMessage } from '../api/types.ts'
import { useSession } from '../context/session.ts'
import { DemoBanner, GuestLimitCard, UsageLine } from '../features/chat/ChatNotices.tsx'
import { ChatView, type ChatFailure } from '../features/chat/ChatView.tsx'
import { draftFromState } from '../lib/chatDraft.ts'
import { loadGuestChat, saveGuestChat, type GuestChat } from '../lib/guestChat.ts'
import { useStreamingReply } from '../lib/useStreamingReply.ts'

const GUEST_CONTEXT_MESSAGES = 20

/**
 * Chat de invitado: pocos mensajes al día y todo se guarda solo en este navegador hasta que inicia sesión.
 */
export function GuestChatPage() {
  const { me, setUsage } = useSession()
  const location = useLocation()
  const [chat, setChat] = useState<GuestChat | null>(() => loadGuestChat())
  const [failure, setFailure] = useState<ChatFailure | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  const reply = useStreamingReply()
  const chatRef = useRef(chat)

  useEffect(() => {
    chatRef.current = chat
    if (chat) saveGuestChat(chat)
  }, [chat])

  if (!me) return null
  // Si ya tiene sesión, AppShell se encarga de guardar esta consulta en su cuenta
  if (me.authenticated || !chat) return <Navigate to="/" replace />

  const ask = async (history: ChatMessage[], text: string): Promise<boolean> => {
    const current = chatRef.current
    if (!current || reply.busy) return false
    setFailure(null)
    const question: ChatMessage = { role: 'user', content: text }
    setChat({ ...current, messages: [...history, question] })

    // El servidor solo usa los últimos mensajes como contexto
    const recent = history.slice(-GUEST_CONTEXT_MESSAGES)
    const result = await reply.run((onDelta, signal) => streamGuest(current.vehicle, recent, text, onDelta, signal))
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
      setChat((c) => c && { ...c, messages: history })
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
      vehicle={chat.vehicle}
      messages={chat.messages}
      streamingText={reply.streamingText}
      failure={failure}
      banner={me.features.aiDemo ? <DemoBanner /> : undefined}
      notice={blocked ? <GuestLimitCard freeDailyMessages={me.features.freeDailyMessages} /> : undefined}
      inputDisabled={blocked}
      initialDraft={draftFromState(location.state)}
      footer={<UsageLine usage={me.usage} guest />}
      onSend={(text) => ask(chat.messages, text)}
      onStop={reply.stop}
    />
  )
}

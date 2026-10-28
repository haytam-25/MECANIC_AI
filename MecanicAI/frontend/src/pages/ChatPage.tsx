import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import { createConversation, fetchConversation, streamMessage, streamRetry } from '../api/endpoints.ts'
import { ApiError } from '../api/http.ts'
import type { ChatMessage, Vehicle } from '../api/types.ts'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { DemoBanner, UsageLine, UserLimitCard } from '../features/chat/ChatNotices.tsx'
import { ChatView } from '../features/chat/ChatView.tsx'
import { chatPath, chatsPath } from '../features/garage/paths.ts'
import { draftFromState } from '../lib/chatDraft.ts'
import { useStreamingReply, type ReplyResult } from '../lib/useStreamingReply.ts'

interface LoadedChat {
  /** null hasta que se envía la primera pregunta (así no se crean conversaciones vacías). */
  id: string | null
  vehicle: Vehicle
  messages: ChatMessage[]
}

/** Si la pregunta llegó a guardarse en el servidor (el fallo fue de la IA o de la conexión a mitad). */
function questionWasSaved(error: ApiError): boolean {
  return error.status === 502 || error.code === 'INTERRUPTED'
}

/**
 * Chat con cuenta: /coche/:vehicleId/consultas/:id (consulta guardada) o /coche/:vehicleId/consultas/nuevo.
 */
export function ChatPage() {
  const { vehicleId, conversationId } = useParams()
  const isNew = conversationId === 'nuevo'
  const { me, vehicles, refreshLists, refreshMe, setUsage } = useSession()
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useToast()
  const reply = useStreamingReply()
  const [chat, setChat] = useState<LoadedChat | null>(null)
  /** Mensaje del último fallo de la IA (la pregunta está guardada y se puede reintentar). */
  const [failure, setFailure] = useState<string | null>(null)
  const [limitReached, setLimitReached] = useState(false)
  /** Conversación que ya está en pantalla (evita recargarla al cambiar la URL tras la primera pregunta). */
  const shownId = useRef<string | null>(null)

  // Carga de la conversación o preparación de una nueva
  useEffect(() => {
    if (!me?.authenticated || !vehicleId) return
    if (isNew) {
      const vehicle = vehicles.find((v) => v.id === vehicleId)
      if (!vehicle) {
        navigate('/', { replace: true })
        return
      }
      shownId.current = null
      // Reinicio intencionado al abrir una consulta nueva: el componente no se desmonta para no cortar
      // la respuesta en curso cuando la URL pasa de …/consultas/nuevo a …/consultas/:id
      // oxlint-disable-next-line react/set-state-in-effect
      setChat({ id: null, vehicle, messages: [] })
      setFailure(null)
      setLimitReached(false)
      return
    }
    if (!conversationId || shownId.current === conversationId) return
    const requested = conversationId
    shownId.current = requested
    // Si mientras tanto se abrió otra consulta, esta respuesta ya no interesa
    const stillShown = () => shownId.current === requested
    fetchConversation(requested)
      .then((detail) => {
        if (!stillShown()) return
        setChat({ id: detail.id, vehicle: detail.vehicle, messages: detail.messages })
        setFailure(detail.messages.at(-1)?.role === 'user' ? 'Esta pregunta se quedó sin respuesta.' : null)
        setLimitReached(false)
      })
      .catch((error: unknown) => {
        if (!stillShown()) return
        toast(error instanceof ApiError ? error.message : 'No se pudo abrir la consulta.', 'error')
        navigate(chatsPath(vehicleId), { replace: true })
      })
  }, [me?.authenticated, isNew, vehicleId, conversationId, vehicles, navigate, toast])

  useEffect(() => {
    if (!chat) return
    // Al salir vuelve el título de index.html (el que ve Google)
    const previous = document.title
    document.title = `${chat.vehicle.brand} ${chat.vehicle.model} · MecanicAI`
    return () => {
      document.title = previous
    }
  }, [chat])

  if (!chat || !me || (!isNew && chat.id !== conversationId)) {
    return (
      <div className="center-screen" aria-busy="true">
        <Wheel size={56} spinning title="Cargando la consulta" />
      </div>
    )
  }

  /** Aplica el resultado de una respuesta; devuelve false si la pregunta no llegó a enviarse. */
  const handleResult = (result: ReplyResult, question?: ChatMessage): boolean => {
    if (result.done) {
      const { done } = result
      setChat((c) => c && { ...c, messages: [...c.messages, { id: done.messageId, role: 'assistant', content: result.text }] })
      setUsage(done.usage)
      void refreshLists()
      return true
    }
    if (result.aborted) {
      if (result.text.trim()) {
        setChat((c) => c && { ...c, messages: [...c.messages, { role: 'assistant', content: result.text }] })
      }
      void refreshMe()
      return true
    }
    const error = result.error ?? new ApiError(0, 'UNKNOWN', 'Algo ha fallado.')
    if (error.code === 'QUOTA_EXCEEDED') {
      if (error.usage) setUsage(error.usage)
      setLimitReached(true)
    }
    if (question && !questionWasSaved(error)) {
      // La pregunta no llegó al servidor: se quita y el texto vuelve a la caja
      setChat((c) => c && { ...c, messages: c.messages.filter((m) => m !== question) })
      if (error.code !== 'QUOTA_EXCEEDED') toast(error.message, 'error')
      return false
    }
    setFailure(error.message)
    return true
  }

  const retry = async () => {
    const id = chat.id
    if (!id || reply.busy) return
    setFailure(null)
    handleResult(await reply.run((onDelta, signal) => streamRetry(id, onDelta, signal)))
  }

  const send = async (text: string): Promise<boolean> => {
    if (reply.busy) return false
    setFailure(null)
    const question: ChatMessage = { id: `local-${Date.now()}`, role: 'user', content: text }
    setChat((c) => c && { ...c, messages: [...c.messages, question] })

    let id = chat.id
    if (!id) {
      try {
        const created = await createConversation(chat.vehicle.id)
        id = created.id
        shownId.current = created.id
        setChat((c) => c && { ...c, id: created.id })
        navigate(chatPath(chat.vehicle.id, created.id), { replace: true })
      } catch (error) {
        setChat((c) => c && { ...c, messages: c.messages.filter((m) => m !== question) })
        toast(error instanceof ApiError ? error.message : 'No se pudo crear la consulta.', 'error')
        return false
      }
    }
    const conversation = id
    return handleResult(await reply.run((onDelta, signal) => streamMessage(conversation, text, onDelta, signal)), question)
  }

  const blocked = limitReached || me.usage.remaining <= 0

  return (
    <ChatView
      vehicle={chat.vehicle}
      backTo={chatsPath(chat.vehicle.id)}
      messages={chat.messages}
      streamingText={reply.streamingText}
      failure={failure ? { message: failure, onRetry: () => void retry() } : null}
      banner={me.features.aiDemo ? <DemoBanner /> : undefined}
      notice={blocked ? <UserLimitCard usage={me.usage} /> : undefined}
      inputDisabled={blocked}
      initialDraft={draftFromState(location.state)}
      footer={<UsageLine usage={me.usage} guest={false} />}
      onSend={send}
      onStop={reply.stop}
    />
  )
}

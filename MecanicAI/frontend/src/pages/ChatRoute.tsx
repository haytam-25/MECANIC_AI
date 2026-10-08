import { useSession } from '../context/session.ts'
import { ChatPage } from './ChatPage.tsx'
import { GuestChatPage } from './GuestChatPage.tsx'

/** /coche/:vehicleId/consultas/:conversationId: el chat de la cuenta o el del modo invitado. */
export function ChatRoute() {
  const { me } = useSession()
  if (!me) return null
  return me.authenticated ? <ChatPage /> : <GuestChatPage />
}

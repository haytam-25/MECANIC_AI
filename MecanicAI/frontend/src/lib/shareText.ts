import type { ChatMessage, VehicleSpec } from '../api/types.ts'
import { displayName } from './vehicle.ts'

/** Lo que cabe con seguridad en un enlace de WhatsApp (el texto viaja en la URL). */
const MAX_TEXT = 3000

const SITE = 'https://mecanicai.org'

/** Se puede compartir cuando el mecánico ya ha respondido algo y no está escribiendo. */
export function canShare(messages: ChatMessage[], busy: boolean): boolean {
  return !busy && messages.some((message) => message.role === 'assistant')
}

/** Abre WhatsApp con el texto ya escrito para que el usuario elija a quién enviarlo. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Mensaje de WhatsApp con el enlace a una consulta compartida. */
export function sharedLinkText(vehicle: Pick<VehicleSpec, 'brand' | 'model'>, url: string): string {
  return `Mira lo que me ha dicho MecanicAI sobre mi ${vehicle.brand} ${vehicle.model}:\n${url}`
}

/** Markdown de la IA con el formato de WhatsApp: *negrita* con un solo asterisco, títulos en negrita y viñetas. */
function toWhatsapp(markdown: string): string {
  return markdown
    .replace(/^(\s*)[*+-]\s+/gm, '$1• ')
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/^#{1,6}\s+(.+)$/gm, (_, title: string) => `*${title.replace(/\*/g, '').trim()}*`)
    .trim()
}

/**
 * La consulta entera como texto, para enviarla por WhatsApp sin subirla a ningún sitio (modo invitado). Si no cabe,
 * se quedan los últimos mensajes.
 */
export function conversationAsText(vehicle: VehicleSpec, messages: ChatMessage[]): string {
  const header = `*Consulta a MecanicAI · ${displayName(vehicle)}*`
  const footer = `Pregunta tú por tu coche al mecánico con IA: ${SITE}`
  const skipped = '(…)'
  let room = MAX_TEXT - header.length - footer.length - skipped.length - 8

  const blocks: string[] = []
  for (const message of messages.toReversed()) {
    const block =
      message.role === 'user' ? `*Yo:* ${message.content.trim()}` : `*MecanicAI:*\n${toWhatsapp(message.content)}`
    if (block.length + 2 > room) {
      // Ni el último mensaje cabe entero: se envía su principio
      if (blocks.length === 0) blocks.push(`${block.slice(0, Math.max(room - 1, 0))}…`)
      blocks.push(skipped)
      break
    }
    blocks.push(block)
    room -= block.length + 2
  }
  return [header, ...blocks.reverse(), footer].join('\n\n')
}

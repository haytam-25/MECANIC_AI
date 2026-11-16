import { useRef, useState } from 'react'

import { shareConversation, unshareConversation } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { ChatMessage, ShareLink, VehicleSpec } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { useToast } from '../../context/toast.ts'
import { conversationAsText, sharedLinkText, whatsappUrl } from '../../lib/shareText.ts'
import { sharedPath } from '../garage/paths.ts'

interface ShareButtonProps {
  vehicle: VehicleSpec
  messages: ChatMessage[]
  /** Consulta guardada en la cuenta. Sin ella (modo invitado) no hay enlace: se envía la consulta como texto. */
  conversationId?: string
}

type LinkState = { status: 'loading' } | { status: 'ready'; link: ShareLink } | { status: 'error'; message: string }

/**
 * Botón "Compartir" del chat. Con cuenta crea un enlace público a la consulta y lo envía por WhatsApp; el invitado,
 * cuya consulta solo existe en su navegador, la envía como texto.
 */
export function ShareButton({ vehicle, messages, conversationId }: ShareButtonProps) {
  const toast = useToast()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [state, setState] = useState<LinkState>({ status: 'loading' })
  const [copied, setCopied] = useState(false)

  const open = () => {
    if (!conversationId) {
      window.open(whatsappUrl(conversationAsText(vehicle, messages)), '_blank', 'noopener,noreferrer')
      return
    }
    setState({ status: 'loading' })
    setCopied(false)
    dialogRef.current?.showModal()
    shareConversation(conversationId).then(
      (link) => setState({ status: 'ready', link }),
      (error: unknown) =>
        setState({
          status: 'error',
          message: error instanceof ApiError ? error.message : 'No se pudo crear el enlace.',
        }),
    )
  }

  const close = () => dialogRef.current?.close()

  const stopSharing = async () => {
    if (!conversationId) return
    try {
      await unshareConversation(conversationId)
      toast('La consulta ya no se comparte: el enlace ha dejado de funcionar.', 'success')
      close()
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo dejar de compartir.', 'error')
    }
  }

  const url = state.status === 'ready' ? window.location.origin + sharedPath(state.link.token) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // El navegador no permite copiar
    }
  }

  return (
    <>
      <button type="button" className="btn btn--ghost btn--xs share-btn" onClick={open} aria-label="Compartir por WhatsApp">
        <Icon name="share" size={16} /> <span className="share-btn__label">Compartir</span>
      </button>

      {conversationId && (
        // Al tocar fuera del cuadro (el fondo es el propio <dialog>) se cierra
        <dialog
          ref={dialogRef}
          className="share-dialog"
          aria-labelledby="share-dialog-title"
          onClick={(event) => event.target === event.currentTarget && close()}
        >
          <div className="share-dialog__box">
            <div className="share-dialog__head">
              <h2 id="share-dialog-title">Compartir la consulta</h2>
              <button type="button" className="icon-btn icon-btn--sm" onClick={close} aria-label="Cerrar">
                <Icon name="close" size={18} />
              </button>
            </div>

            {state.status === 'loading' && (
              <p className="muted" aria-busy="true">
                Creando el enlace…
              </p>
            )}

            {state.status === 'error' && (
              <div className="notice notice--error" role="alert">
                <Icon name="alert" size={20} />
                <span>{state.message}</span>
              </div>
            )}

            {state.status === 'ready' && (
              <>
                <p className="small">
                  Quien tenga el enlace podrá leer esta consulta <strong>hasta el último mensaje de ahora</strong>, sin
                  necesidad de cuenta. No verá tu nombre ni tu matrícula.
                </p>
                <p className="share-dialog__url">{url}</p>
                <a
                  className="btn btn--primary btn--block"
                  href={whatsappUrl(sharedLinkText(vehicle, url))}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Icon name="share" size={18} /> Enviar por WhatsApp
                </a>
                <button type="button" className="btn btn--ghost btn--block btn--sm" onClick={() => void copy()}>
                  <Icon name={copied ? 'check' : 'copy'} size={16} /> {copied ? 'Enlace copiado' : 'Copiar enlace'}
                </button>
                <p className="muted small">
                  El enlace caduca el {formatDay(state.link.expiresAt)}. Si sigues la consulta, vuelve a pulsar
                  «Compartir» para que el enlace enseñe también lo nuevo.
                </p>
                <button type="button" className="link-btn link-btn--danger small" onClick={() => void stopSharing()}>
                  Dejar de compartir
                </button>
              </>
            )}
          </div>
        </dialog>
      )}
    </>
  )
}

/** "16 de diciembre" */
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
}

import { useCallback, useEffect, useRef, useState } from 'react'

import { ApiError, isAbort } from '../api/http.ts'
import type { OnDelta } from '../api/sse.ts'
import type { StreamDone } from '../api/types.ts'
import { createTypewriter } from './typewriter.ts'

export interface ReplyResult {
  /** Presente si la respuesta terminó bien. */
  done?: StreamDone
  /** Texto recibido (completo o parcial). */
  text: string
  /** El usuario pulsó "detener". */
  aborted: boolean
  error?: ApiError
}

type StartStream = (onDelta: OnDelta, signal: AbortSignal) => Promise<StreamDone>

/**
 * Gestiona una respuesta de la IA en streaming: texto parcial para pintarlo en vivo y botón de detener.
 *
 * El texto no se pinta tal cual llega (la IA lo manda a trompicones) sino que se va escribiendo a ritmo constante.
 * La respuesta no se da por acabada hasta que termina de escribirse; "detener" en ese tramo final la muestra entera.
 */
export function useStreamingReply() {
  const [text, setText] = useState<string | null>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const run = useCallback(async (start: StartStream): Promise<ReplyResult> => {
    const controller = new AbortController()
    controllerRef.current = controller
    const typewriter = createTypewriter(setText)
    let received = ''
    setText('')
    try {
      const done = await start((delta, reset) => {
        // Si la IA empezó de nuevo con otro modelo, el texto anterior se descarta
        received = reset ? delta : received + delta
        typewriter.write(received, reset)
      }, controller.signal)
      await typewriter.finish(controller.signal)
      return { done, text: received, aborted: false }
    } catch (error) {
      if (isAbort(error)) return { text: received, aborted: true }
      const apiError =
        error instanceof ApiError ? error : new ApiError(0, 'UNKNOWN', 'Algo ha fallado. Inténtalo de nuevo.')
      return { text: received, aborted: false, error: apiError }
    } finally {
      typewriter.cancel()
      controllerRef.current = null
      setText(null)
    }
  }, [])

  const stop = useCallback(() => controllerRef.current?.abort(), [])

  return { streamingText: text, busy: text !== null, run, stop }
}

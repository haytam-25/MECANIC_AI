import { ApiError, CSRF_HEADER, isAbort, networkError, toApiError } from './http.ts'
import type { StreamDone } from './types.ts'

const INTERRUPTED = 'Se cortó la conexión antes de terminar la respuesta.'

interface SseEvent {
  name: string
  data: string
}

/** Interpreta un bloque "event: x / data: y" de Server-Sent Events. */
export function parseSseEvent(raw: string): SseEvent | null {
  let name = 'message'
  const data: string[] = []
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  return data.length > 0 ? { name, data: data.join('\n') } : null
}

/**
 * Recibe cada trozo de la respuesta. `reset` indica que la IA empezó de nuevo con otro modelo
 * (se cortó a mitad): hay que sustituir el texto recibido hasta ahora en lugar de añadir.
 */
export type OnDelta = (text: string, reset: boolean) => void

/**
 * Hace un POST y lee la respuesta de la IA en streaming. El backend envía eventos
 * `delta` ({text, reset?}) con cada trozo y al final `done` (datos del mensaje) o `error`.
 */
export async function postStream(path: string, body: unknown, onDelta: OnDelta, signal: AbortSignal): Promise<StreamDone> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: {
        ...CSRF_HEADER,
        Accept: 'text/event-stream, application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal,
    })
  } catch (error) {
    if (isAbort(error)) throw error
    throw networkError()
  }
  if (!res.ok || !res.body) throw await toApiError(res)

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let done: StreamDone | null = null
  try {
    for (;;) {
      const chunk = await reader.read()
      if (chunk.done) break
      buffer += decoder.decode(chunk.value, { stream: true })
      let boundary: RegExpExecArray | null
      while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
        const event = parseSseEvent(buffer.slice(0, boundary.index))
        buffer = buffer.slice(boundary.index + boundary[0].length)
        if (!event) continue
        if (event.name === 'delta') {
          const delta = JSON.parse(event.data) as { text: string; reset?: boolean }
          onDelta(delta.text, delta.reset === true)
        } else if (event.name === 'done') {
          done = JSON.parse(event.data) as StreamDone
        } else if (event.name === 'error') {
          const error = JSON.parse(event.data) as { code: string; message: string }
          throw new ApiError(502, error.code, error.message)
        }
      }
    }
  } catch (error) {
    if (error instanceof ApiError || isAbort(error)) throw error
    throw new ApiError(0, 'INTERRUPTED', INTERRUPTED)
  }
  if (!done) throw new ApiError(0, 'INTERRUPTED', INTERRUPTED)
  return done
}

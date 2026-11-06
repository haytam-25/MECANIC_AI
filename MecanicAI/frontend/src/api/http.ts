import type { ApiErrorBody, Usage } from './types.ts'

/** Error de la API con el código y mensaje que envía el backend. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly usage?: Usage

  constructor(status: number, code: string, message: string, usage?: Usage) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.usage = usage
  }
}

/**
 * Cabecera obligatoria en las peticiones que modifican datos: es la protección CSRF del backend.
 */
export const CSRF_HEADER = { 'X-MecanicAI': '1' }

export function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function networkError(): ApiError {
  return new ApiError(0, 'NETWORK', 'Sin conexión. Revisa tu internet e inténtalo de nuevo.')
}

export async function toApiError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>
    if (typeof body?.message === 'string') {
      return new ApiError(res.status, body.code ?? 'ERROR', body.message, body.usage)
    }
  } catch {
    // La respuesta no era JSON
  }
  return new ApiError(res.status, `HTTP_${res.status}`, 'Algo ha fallado. Inténtalo de nuevo.')
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

/** Reintentos cuando nginx frena una ráfaga (p. ej. al pasar a la cuenta el garaje de invitado, petición a petición). */
const FLOOD_RETRIES = 3

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined
  let res: Response
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(path, {
        method: options.method ?? 'GET',
        headers: {
          ...CSRF_HEADER,
          Accept: 'application/json',
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        },
        body: hasBody ? JSON.stringify(options.body) : undefined,
        credentials: 'same-origin',
        signal: options.signal,
      })
    } catch (error) {
      if (isAbort(error)) throw error
      throw networkError()
    }
    // Solo el 429 de nginx lleva Retry-After (los del backend son cupos de verdad): esa petición no llegó al backend,
    // así que repetirla no duplica nada. nginx deja pasar 10 por segundo, basta con esperar un poco
    if (res.status !== 429 || !res.headers.has('Retry-After') || attempt >= FLOOD_RETRIES) break
    await wait(1000 * (attempt + 1), options.signal)
  }
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/**
 * Sube un formulario con archivos (multipart) avisando del progreso (0 a 1), que fetch no sabe dar. Mismos errores que
 * {@link api}.
 */
export function upload<T>(path: string, form: FormData, onProgress?: (fraction: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', path)
    for (const [name, value] of Object.entries(CSRF_HEADER)) xhr.setRequestHeader(name, value)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    xhr.onload = () => {
      let body: unknown = null
      try {
        body = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        // La respuesta no era JSON (p. ej. el 413 de nginx)
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T)
        return
      }
      const error = body as Partial<ApiErrorBody> | null
      if (typeof error?.message === 'string') {
        reject(new ApiError(xhr.status, error.code ?? 'ERROR', error.message, error.usage))
      } else if (xhr.status === 413) {
        reject(new ApiError(413, 'FILE_TOO_LARGE', 'El archivo pesa demasiado (máximo 5 MB).'))
      } else {
        reject(new ApiError(xhr.status, `HTTP_${xhr.status}`, 'Algo ha fallado. Inténtalo de nuevo.'))
      }
    }
    xhr.onerror = () => reject(networkError())
    xhr.send(form)
  })
}

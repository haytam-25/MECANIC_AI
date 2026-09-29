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

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const hasBody = options.body !== undefined
  let res: Response
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
  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

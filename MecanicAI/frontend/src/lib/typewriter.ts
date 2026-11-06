/** Velocidad mínima a la que se escribe la respuesta (caracteres por segundo). */
const MIN_SPEED = 40
/**
 * Segundos que tardaría en escribirse todo lo pendiente. Si la IA manda un trozo grande la velocidad sube, así el
 * texto fluye sin saltos y nunca se queda muy por detrás. Más alto = más pausado.
 */
const CATCH_UP = 2.2
/** Segundos que tarda la velocidad en adaptarse (evita acelerones bruscos cuando llega un trozo grande). */
const EASE = 0.5
/** Mínimo entre repintados (ms): ~30 por segundo se ven fluidos y el Markdown no se procesa en cada frame. */
const PAINT_EVERY = 33

export interface Typewriter {
  /** Texto recibido hasta ahora (entero, no solo el trozo nuevo). `restart` lo vuelve a escribir desde el principio. */
  write(text: string, restart: boolean): void
  /** Espera a que se termine de escribir lo recibido. Si se aborta `signal`, termina ya (el texto se muestra entero). */
  finish(signal: AbortSignal): Promise<void>
  /** Para la animación sin pintar nada más. */
  cancel(): void
}

/**
 * Escribe poco a poco el texto que va llegando de la IA, que suele llegar a trompicones (a veces varias frases de
 * golpe). `paint` recibe el texto visible en cada momento.
 */
export function createTypewriter(paint: (visible: string) => void): Typewriter {
  let target = ''
  /** Caracteres ya escritos (con decimales: en cada frame avanza una fracción). */
  let shown = 0
  let speed = MIN_SPEED
  let frame = 0
  let lastTick = 0
  let lastPaint = -Infinity
  let onCaughtUp: (() => void) | null = null

  const visible = () => {
    let end = Math.floor(shown)
    // Sin partir un emoji por la mitad (ocupa dos posiciones en el texto)
    const code = target.charCodeAt(end - 1)
    if (end < target.length && code >= 0xd800 && code <= 0xdbff) end++
    return target.slice(0, end)
  }

  const tick = (now: number) => {
    const dt = Math.max(0, now - lastTick) / 1000
    lastTick = now
    const wanted = Math.max(MIN_SPEED, (target.length - shown) / CATCH_UP)
    speed += (wanted - speed) * Math.min(1, dt / EASE)
    // Con la pestaña en segundo plano no hay frames: al volver, dt es grande y se pone al día de golpe
    shown = Math.min(target.length, shown + speed * dt)
    const caughtUp = shown >= target.length
    if (caughtUp || now - lastPaint >= PAINT_EVERY) {
      lastPaint = now
      paint(visible())
    }
    if (caughtUp) {
      frame = 0
      onCaughtUp?.()
    } else {
      frame = requestAnimationFrame(tick)
    }
  }

  return {
    write(text, restart) {
      target = text
      if (restart) shown = 0
      if (!frame) {
        // Tras esperar al siguiente trozo se sigue al mismo ritmo, sin "recuperar" el tiempo parado
        lastTick = performance.now()
        frame = requestAnimationFrame(tick)
      }
    },
    finish(signal) {
      return new Promise((resolve) => {
        const done = () => {
          signal.removeEventListener('abort', done)
          onCaughtUp = null
          resolve()
        }
        if (signal.aborted || (shown >= target.length && !frame)) {
          done()
          return
        }
        onCaughtUp = done
        signal.addEventListener('abort', done)
      })
    },
    cancel() {
      cancelAnimationFrame(frame)
      frame = 0
      onCaughtUp = null
    },
  }
}

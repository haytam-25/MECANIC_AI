/** Línea que de momento solo tiene el símbolo de una lista, título o cita ("-", "1.", "##", ">"...). */
const BARE_MARKER = /^\s*(?:[-*+>#=_]+|\d+[.)]?)?\s*$/
const FENCE = /^ {0,3}(?:```|~~~)/

function occurrences(text: string, mark: string): number {
  return text.split(mark).length - 1
}

/**
 * Prepara para pintarlo el Markdown de una respuesta que se está escribiendo: la última línea puede quedar cortada a
 * mitad de una **negrita** o de un `código`, y se cierran (o se quita el símbolo recién abierto) para que no asomen
 * asteriscos ni comillas. Una línea que solo tiene el símbolo de lista o título espera a tener texto: sola se
 * malinterpreta (un "-" bajo un párrafo lo convierte en título).
 */
export function closeOpenMarkdown(text: string): string {
  const start = text.lastIndexOf('\n') + 1
  // Dentro de un bloque de código no hay nada que cerrar
  if ((text.match(new RegExp(FENCE.source, 'gm'))?.length ?? 0) % 2 === 1) return text
  let line = text.slice(start)
  if (FENCE.test(line)) return text

  if (occurrences(line, '`') % 2 === 1) {
    line = line.endsWith('`') ? line.slice(0, -1) : `${line}\``
  }
  // Cursiva (*así*) sin cerrar. Si el "*" suelto está al final se quita: puede ser la primera mitad de "**"
  const singles = occurrences(line.replace(/^\s*[*+-]\s+/, '').replace(/\*{2,}/g, ''), '*')
  if (singles % 2 === 1) {
    line = /(^|[^*])\*$/.test(line) ? line.slice(0, -1) : `${line.trimEnd()}*`
  }
  if (occurrences(line, '**') % 2 === 1) {
    // El cierre no puede ir tras un espacio, y una negrita aún vacía ("**") se quita
    const trimmed = line.trimEnd()
    line = trimmed.endsWith('**') ? trimmed.slice(0, -2) : `${trimmed}**`
  }
  if (BARE_MARKER.test(line)) line = ''
  return text.slice(0, start) + line
}

/** Nodo del HTML que genera el Markdown (hast), con lo justo para recorrerlo. */
interface HastNode {
  type: string
  tagName?: string
  value?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

/** Bloques en los que se entra para dejar el cursor justo detrás de la última letra. */
const CARET_CONTAINERS = new Set(['p', 'ul', 'ol', 'li', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre'])

/**
 * Plugin de rehype que añade el cursor de escritura (`<span class="caret">`) tras la última letra, también cuando
 * el texto acaba dentro de una lista o una cita.
 */
export function rehypeCaret() {
  return (tree: HastNode) => {
    let parent = tree
    for (;;) {
      const last = parent.children?.findLast((node) => node.type !== 'text' || node.value?.trim())
      if (last?.type !== 'element' || !CARET_CONTAINERS.has(last.tagName ?? '')) break
      parent = last
    }
    parent.children ??= []
    parent.children.push({
      type: 'element',
      tagName: 'span',
      properties: { className: ['caret'], ariaHidden: true },
      children: [],
    })
  }
}

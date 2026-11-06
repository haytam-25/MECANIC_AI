import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { closeOpenMarkdown, rehypeCaret } from '../lib/streamingMarkdown.ts'

const components: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node: _node, ...props }) => (
    <div className="md__table">
      <table {...props} />
    </div>
  ),
}

const remarkPlugins = [remarkGfm]
const streamingRehypePlugins = [rehypeCaret]

interface MarkdownTextProps {
  text: string
  /** El texto se está escribiendo: se ocultan los símbolos a medio cerrar y se pinta un cursor al final. */
  streaming?: boolean
}

/** Respuesta de la IA en Markdown (listas, negritas, pasos...). No se renderiza HTML crudo. */
export function MarkdownText({ text, streaming = false }: MarkdownTextProps) {
  return (
    <div className="md">
      <Markdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={streaming ? streamingRehypePlugins : undefined}
        components={components}
      >
        {streaming ? closeOpenMarkdown(text) : text}
      </Markdown>
    </div>
  )
}

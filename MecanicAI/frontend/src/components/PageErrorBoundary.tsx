import { Component, type ReactNode } from 'react'

import { Icon } from './Icon.tsx'
import { Wheel } from './Wheel.tsx'

interface PageErrorBoundaryProps {
  children: ReactNode
  /** Al cambiar (otra página), se vuelve a intentar. No se usa como `key` para no desmontar la página en curso. */
  resetKey: string
}

interface PageErrorBoundaryState {
  failed: boolean
  resetKey: string
}

/**
 * Si una página no se puede mostrar (p. ej. no se pudo descargar sin conexión), un aviso con el botón de recargar en
 * lugar de dejar la app en blanco.
 */
export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { failed: false, resetKey: this.props.resetKey }

  static getDerivedStateFromError(): Partial<PageErrorBoundaryState> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: PageErrorBoundaryProps, state: PageErrorBoundaryState) {
    return props.resetKey !== state.resetKey ? { failed: false, resetKey: props.resetKey } : null
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="center-screen" role="alert">
        <Wheel size={72} />
        <h1 className="page-title">No se pudo abrir esta página</h1>
        <p className="muted">Revisa tu conexión y vuelve a intentarlo.</p>
        <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
          <Icon name="refresh" size={20} /> Recargar
        </button>
      </div>
    )
  }
}

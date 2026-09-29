import { Link } from 'react-router'

import { Wheel } from '../components/Wheel.tsx'

export function NotFoundPage() {
  return (
    <div className="center-screen">
      <Wheel size={72} />
      <h1 className="page-title">Esta página se ha quedado sin gasolina</h1>
      <p className="muted">No existe o se ha movido.</p>
      <Link to="/" className="btn btn--primary">
        Volver al inicio
      </Link>
    </div>
  )
}

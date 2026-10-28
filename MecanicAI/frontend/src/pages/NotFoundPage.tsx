import { useEffect } from 'react'
import { Link } from 'react-router'

import { Wheel } from '../components/Wheel.tsx'

export function NotFoundPage() {
  // Que Google no indexe esta página (nginx ya responde 404 a las rutas que no existen; esto cubre el resto)
  useEffect(() => {
    const robots = document.createElement('meta')
    robots.name = 'robots'
    robots.content = 'noindex'
    document.head.append(robots)
    return () => robots.remove()
  }, [])

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

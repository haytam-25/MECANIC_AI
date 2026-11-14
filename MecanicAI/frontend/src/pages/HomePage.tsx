import { useOutletContext, useSearchParams } from 'react-router'

import { Icon } from '../components/Icon.tsx'
import { Wheel } from '../components/Wheel.tsx'
import type { ShellContext } from '../components/AppShell.tsx'
import { useSession } from '../context/session.ts'
import { useVehicleSetup } from '../features/wizard/useVehicleSetup.ts'
import { VehicleWizard } from '../features/wizard/VehicleWizard.tsx'
import '../features/garage/garage.css'
import './pages.css'

/** Como mucho, lo que se acepta de la pregunta que llega en el enlace (/?q=…). */
const MAX_LINK_QUESTION = 500

/**
 * Inicio: el asistente para elegir el coche. Los coches ya guardados están en el garaje (menú lateral).
 *
 * Las páginas estáticas (averías por modelo, códigos de avería) enlazan aquí con el coche o la pregunta ya puestos:
 * /?marca=seat&modelo=ibiza abre el asistente en el año, y /?q=… lleva la pregunta al chat al terminar de elegir el coche.
 */
export function HomePage() {
  const { me, vehicles } = useSession()
  const { openGarage } = useOutletContext<ShellContext>()
  const [params] = useSearchParams()
  const question = params.get('q')?.trim().slice(0, MAX_LINK_QUESTION) || undefined
  const complete = useVehicleSetup(question)

  if (!me) return null

  return (
    <div className="page">
      <header className="hero">
        <Wheel size={64} className="hero__wheel" />
        <div>
          <h1 className="hero__title">Selecciona tu coche</h1>
          <p className="hero__text">Elige tu coche y cuéntame qué le pasa: averías, ruidos, testigos o mantenimiento.</p>
        </div>
      </header>
      {vehicles.length > 0 && (
        <button type="button" className="garage-hint" onClick={openGarage}>
          <Icon name="car" size={20} />
          <span>
            {vehicles.length === 1 ? 'Tienes 1 coche' : `Tienes ${vehicles.length} coches`} en tu garaje
            {vehicles.length >= me.features.maxVehicles && ' (lleno: borra uno para añadir otro)'}
          </span>
          <span className="garage-hint__cta">
            Abrir garaje <Icon name="next" size={16} />
          </span>
        </button>
      )}
      {question && <p className="muted small center">Elige tu coche y te llevo al chat con tu pregunta ya escrita.</p>}
      <VehicleWizard onComplete={complete} presetBrandId={params.get('marca')} presetModelId={params.get('modelo')} />
      {!me.authenticated && (
        <p className="muted small center">
          Gratis: {me.features.guestDailyMessages} consultas al día sin cuenta. Con Google, {me.features.freeDailyMessages}{' '}
          al día y tus coches guardados.
        </p>
      )}
    </div>
  )
}

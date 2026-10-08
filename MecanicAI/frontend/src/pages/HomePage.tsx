import { useOutletContext } from 'react-router'

import { Icon } from '../components/Icon.tsx'
import { Wheel } from '../components/Wheel.tsx'
import type { ShellContext } from '../components/AppShell.tsx'
import { useSession } from '../context/session.ts'
import { useVehicleSetup } from '../features/wizard/useVehicleSetup.ts'
import { VehicleWizard } from '../features/wizard/VehicleWizard.tsx'
import '../features/garage/garage.css'
import './pages.css'

/** Inicio: el asistente para elegir el coche. Los coches ya guardados están en el garaje (menú lateral). */
export function HomePage() {
  const { me, vehicles } = useSession()
  const { openGarage } = useOutletContext<ShellContext>()
  const complete = useVehicleSetup()

  if (!me) return null

  return (
    <div className="page">
      <header className="hero">
        <Wheel size={64} className="hero__wheel" />
        <div>
          <h1 className="hero__title">
            Tu mecánico <span className="accent">con IA</span>
          </h1>
          <p className="hero__text">Elige tu coche y cuéntame qué le pasa: averías, ruidos, testigos o mantenimiento.</p>
        </div>
      </header>
      {vehicles.length > 0 && (
        <button type="button" className="garage-hint" onClick={openGarage}>
          <Icon name="car" size={20} />
          <span>
            {vehicles.length === 1 ? 'Tienes 1 coche' : `Tienes ${vehicles.length} coches`} en tu garaje
          </span>
          <span className="garage-hint__cta">
            Abrir garaje <Icon name="next" size={16} />
          </span>
        </button>
      )}
      <VehicleWizard onComplete={complete} />
      {!me.authenticated && (
        <p className="muted small center">
          Gratis: {me.features.guestDailyMessages} consultas al día sin cuenta. Con Google, {me.features.freeDailyMessages}{' '}
          al día y tus coches guardados.
        </p>
      )}
    </div>
  )
}

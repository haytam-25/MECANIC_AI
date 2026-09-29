import { useVehicleSetup } from '../features/wizard/useVehicleSetup.ts'
import { VehicleWizard } from '../features/wizard/VehicleWizard.tsx'
import './pages.css'

export function NewVehiclePage() {
  const complete = useVehicleSetup()
  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Mi garaje</p>
        <h1 className="page-title">Añade tu coche</h1>
      </header>
      <VehicleWizard onComplete={complete} />
    </div>
  )
}

import { Navigate } from 'react-router'

import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { carPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import { useSavedReports } from '../features/report/useSavedReports.ts'
import { VehicleReport } from '../features/report/VehicleReport.tsx'

/**
 * "Informe médico" de un coche del garaje: indica cuándo se le hizo cada mantenimiento y ve un informe por colores
 * de lo que toca cambiar. Con cuenta, el último informe de cada coche queda guardado.
 */
export function ReportPage() {
  const { me } = useSession()
  const vehicle = useGarageVehicle()
  const { reports, remember } = useSavedReports()

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />
  if (reports === null) {
    return (
      <div className="center-screen" aria-busy="true">
        <Wheel size={64} spinning title="Cargando" />
      </div>
    )
  }

  return (
    <VehicleReport
      key={vehicle.id}
      vehicle={vehicle}
      vehicleId={vehicle.id}
      saved={reports.find((r) => r.vehicleId === vehicle.id) ?? null}
      onSaved={remember}
      backTo={carPath(vehicle.id)}
    />
  )
}

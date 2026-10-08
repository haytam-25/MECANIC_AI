import { useParams } from 'react-router'

import type { Vehicle } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'

/** Coche del garaje de la ruta /coche/:vehicleId (undefined si no está: borrado o garaje de invitado perdido). */
export function useGarageVehicle(): Vehicle | undefined {
  const { vehicleId } = useParams()
  const { vehicles } = useSession()
  return vehicles.find((v) => v.id === vehicleId)
}

import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { ApiError } from '../../api/http.ts'
import type { VehicleSpec } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'
import { useToast } from '../../context/toast.ts'
import { carPath } from '../garage/paths.ts'

/**
 * Qué pasa al terminar el asistente: el coche entra en el garaje (con cuenta, en el servidor; como invitado, solo
 * mientras la página esté abierta) y se abre su página, con el chat y el informe médico.
 */
export function useVehicleSetup() {
  const { addVehicle } = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  return useCallback(
    async (spec: VehicleSpec) => {
      try {
        const vehicle = await addVehicle(spec)
        navigate(carPath(vehicle.id))
      } catch (error) {
        toast(error instanceof ApiError ? error.message : 'No se pudo guardar el coche.', 'error')
      }
    },
    [addVehicle, navigate, toast],
  )
}

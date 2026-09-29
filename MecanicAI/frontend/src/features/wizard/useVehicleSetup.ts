import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { createVehicle } from '../../api/endpoints.ts'
import { ApiError } from '../../api/http.ts'
import type { VehicleSpec } from '../../api/types.ts'
import { useSession } from '../../context/session.ts'
import { useToast } from '../../context/toast.ts'
import { saveGuestChat } from '../../lib/guestChat.ts'

/**
 * Qué pasa al terminar el asistente: con cuenta, el coche se guarda en el garaje; como invitado,
 * se guarda en el navegador. En ambos casos se abre el chat.
 */
export function useVehicleSetup() {
  const { me, refreshLists } = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  return useCallback(
    async (spec: VehicleSpec) => {
      if (me?.authenticated) {
        try {
          const vehicle = await createVehicle(spec)
          await refreshLists()
          navigate(`/chat/nuevo?coche=${vehicle.id}`)
        } catch (error) {
          toast(error instanceof ApiError ? error.message : 'No se pudo guardar el coche.', 'error')
        }
      } else {
        saveGuestChat({ vehicle: spec, messages: [] })
        navigate('/chat/invitado')
      }
    },
    [me, refreshLists, navigate, toast],
  )
}

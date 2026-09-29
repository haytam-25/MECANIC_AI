import { useCallback } from 'react'
import { useNavigate } from 'react-router'

import { ApiError } from '../api/http.ts'
import { useSession } from './session.ts'
import { useToast } from './toast.ts'

/** Opciones de inicio de sesión disponibles (Google y, solo en desarrollo, cuenta demo). */
export function useLogin() {
  const { me, loginWithGoogle, loginAsDemo, completeLogin } = useSession()
  const navigate = useNavigate()
  const toast = useToast()

  const loginDemo = useCallback(async () => {
    try {
      await loginAsDemo()
      const path = await completeLogin()
      toast('Has entrado con la cuenta de demostración.', 'success')
      if (path) navigate(path)
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo iniciar sesión.', 'error')
    }
  }, [loginAsDemo, completeLogin, navigate, toast])

  return {
    google: me?.features.googleLogin ?? false,
    demo: me?.features.devLogin ?? false,
    loginWithGoogle,
    loginDemo,
  }
}

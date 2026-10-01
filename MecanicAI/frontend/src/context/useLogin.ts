import { useSession } from './session.ts'

/** Si el servidor tiene configurado el inicio de sesión con Google y cómo iniciarlo. */
export function useLogin() {
  const { me, loginWithGoogle } = useSession()
  return {
    google: me?.features.googleLogin ?? false,
    loginWithGoogle,
  }
}

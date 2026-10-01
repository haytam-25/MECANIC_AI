import { useLogin } from '../context/useLogin.ts'
import { GoogleButton } from './GoogleButton.tsx'

/** Botón para iniciar sesión con Google, si el servidor lo tiene configurado. */
export function LoginOptions() {
  const { google, loginWithGoogle } = useLogin()
  if (!google) {
    return <p className="muted small">El inicio de sesión con Google aún no está configurado en el servidor.</p>
  }
  return (
    <div className="login-options">
      <GoogleButton onClick={loginWithGoogle} />
    </div>
  )
}

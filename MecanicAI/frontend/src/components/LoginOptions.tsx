import { useLogin } from '../context/useLogin.ts'
import { GoogleButton } from './GoogleButton.tsx'

/** Botones para iniciar sesión según lo que tenga configurado el servidor. */
export function LoginOptions() {
  const { google, demo, loginWithGoogle, loginDemo } = useLogin()
  if (!google && !demo) {
    return <p className="muted small">El inicio de sesión con Google aún no está configurado en el servidor.</p>
  }
  return (
    <div className="login-options">
      {google && <GoogleButton onClick={loginWithGoogle} />}
      {demo && (
        <button type="button" className="btn btn--ghost btn--block" onClick={() => void loginDemo()}>
          Entrar con cuenta demo <span className="tag">dev</span>
        </button>
      )}
    </div>
  )
}

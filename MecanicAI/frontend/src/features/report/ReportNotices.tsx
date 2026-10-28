import type { Features, Usage } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { LoginOptions } from '../../components/LoginOptions.tsx'
import { useLogin } from '../../context/useLogin.ts'

/** Aviso al rellenar el formulario como invitado: el informe no se guarda. */
export function GuestReportHint() {
  const { google, loginWithGoogle } = useLogin()
  return (
    <div className="notice notice--demo">
      <Icon name="user" size={15} />
      <span>
        En modo invitado el informe <strong>no se guarda</strong> .
      </span>
      {google && (
        <button type="button" className="link-btn" onClick={loginWithGoogle}>
          Iniciar sesión
        </button>
      )}
    </div>
  )
}

/** Tras ver el informe como invitado: invitación a iniciar sesión para guardarlo (sin cifras: el límite no se dice
 * hasta que se acerca). */
export function SaveReportCard() {
  return (
    <section className="plate save-card">
      <h2 className="report-card__title">Este informe no se guarda</h2>
      <p className="muted">
        Como invitado, al salir de esta página se pierde. Inicia sesión con Google y tendrás{' '}
        <strong>el informe de cada coche guardado</strong> para consultarlo cuando quieras.
      </p>
      <LoginOptions />
    </section>
  )
}

/** Sin informes esta semana (invitados: hoy). */
export function ReportLimitCard({ guest, features, usage }: { guest: boolean; features: Features; usage: Usage }) {
  return (
    <section className="plate save-card">
      <h2 className="report-card__title">Has usado tus informes {guest ? 'de hoy' : 'de esta semana'}</h2>
      {guest ? (
        <>
          <p className="muted">
            Como invitado puedes hacer {features.guestDailyReports} al día. Inicia sesión con Google para{' '}
            <strong>seguir haciendo informes</strong> y tenerlos guardados.
          </p>
          <LoginOptions />
        </>
      ) : (
        <p className="muted">
          Tus {usage.limit} informes semanales se renuevan el lunes. Mientras tanto puedes consultar los
          que ya tienes guardados.
        </p>
      )}
    </section>
  )
}

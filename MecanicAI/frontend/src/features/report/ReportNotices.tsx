import type { Features, Usage } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { LoginOptions } from '../../components/LoginOptions.tsx'
import { useLogin } from '../../context/useLogin.ts'

/** Aviso al rellenar el formulario como invitado: el informe no se guarda y hay menos a la semana. */
export function GuestReportHint({ features }: { features: Features }) {
  const { google, loginWithGoogle } = useLogin()
  return (
    <div className="notice notice--demo">
      <Icon name="user" size={20} />
      <span>
        Como invitado el informe <strong>no se guarda</strong> y puedes hacer {features.guestWeeklyReports} a la semana.
        Con tu cuenta de Google se guarda en tu garaje y puedes hacer {features.freeWeeklyReports}.
      </span>
      {google && (
        <button type="button" className="link-btn" onClick={loginWithGoogle}>
          Iniciar sesión
        </button>
      )}
    </div>
  )
}

/** Tras ver el informe como invitado: invitación a iniciar sesión para guardarlo. */
export function SaveReportCard({ features }: { features: Features }) {
  return (
    <section className="plate save-card">
      <h2 className="report-card__title">Este informe no se guarda</h2>
      <p className="muted">
        Como invitado, al salir de esta página se pierde. Inicia sesión con Google y tendrás{' '}
        <strong>el informe de cada coche guardado</strong> para consultarlo cuando quieras, y hasta{' '}
        <strong>{features.freeWeeklyReports} informes a la semana</strong> (ahora {features.guestWeeklyReports}).
      </p>
      <LoginOptions />
    </section>
  )
}

/** Sin informes esta semana. */
export function ReportLimitCard({ guest, features, usage }: { guest: boolean; features: Features; usage: Usage }) {
  return (
    <section className="plate save-card">
      <h2 className="report-card__title">Has usado tus informes de esta semana</h2>
      {guest ? (
        <>
          <p className="muted">
            Como invitado puedes hacer {features.guestWeeklyReports} a la semana. Inicia sesión con Google para hacer
            hasta <strong>{features.freeWeeklyReports} a la semana</strong> y tenerlos guardados.
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

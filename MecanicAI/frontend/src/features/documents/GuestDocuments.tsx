import type { CSSProperties } from 'react'

import { Icon } from '../../components/Icon.tsx'
import { LoginOptions } from '../../components/LoginOptions.tsx'
import { FIXED_KINDS, KIND_INFO } from './documents.ts'

/** Como invitado no se guarda la documentación: se enseñan las carpetas cerradas y se invita a iniciar sesión. */
export function GuestDocuments() {
  return (
    <>
      <ul className="doc-preview" aria-hidden="true">
        {FIXED_KINDS.map((kind, i) => (
          <li key={kind} className={`plate doc-preview__card doc-folder--${kind.toLowerCase()}`} style={{ '--i': i } as CSSProperties}>
            <span className="doc-preview__icon">
              <Icon name={KIND_INFO[kind].icon} size={24} />
            </span>
            <span className="doc-preview__title">{KIND_INFO[kind].title}</span>
            <Icon name="lock" size={16} className="doc-preview__lock" />
          </li>
        ))}
      </ul>

      <section className="plate doc-guest">
        <span className="doc-guest__lock">
          <Icon name="lock" size={26} />
        </span>
        <h2 className="doc-guest__title">Guarda los papeles de tu coche</h2>
        <p className="doc-guest__hand">y olvídate de buscarlos en la guantera</p>
        <p className="muted small">
          La documentación solo se guarda con cuenta: inicia sesión con Google y tenla en cualquier dispositivo.
        </p>
        <ul className="doc-guest__perks">
          <li>
            <Icon name="image" size={18} /> Fotos o PDF del permiso de circulación, la ITV y el seguro
          </li>
          <li>
            <Icon name="bell" size={18} /> Aviso por email antes de que caduquen la ITV o el seguro
          </li>
          <li>
            <Icon name="tag" size={18} /> Tus propias secciones, con el nombre que quieras
          </li>
        </ul>
        <LoginOptions />
      </section>
    </>
  )
}

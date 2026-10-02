/**
 * Enlaces a las páginas legales. Son HTML estático (public/*.html) que sirve nginx, por eso son enlaces normales y
 * no rutas de React.
 */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Información legal">
      <a href="/privacidad">Privacidad</a>
      <a href="/terminos">Términos</a>
      <a href="/cookies">Cookies</a>
    </nav>
  )
}

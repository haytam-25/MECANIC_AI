import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import type { BasketItem, Vehicle } from '../../api/types.ts'
import { Icon } from '../../components/Icon.tsx'
import { formatPlate } from '../../lib/vehicle.ts'

interface TicketProps {
  vehicle: Vehicle
  items: BasketItem[]
  /** Al cerrar el ticket: ids de lo marcado como comprado (sale de la cesta). */
  onClose(boughtIds: string[]): void
}

/** Lo que tarda el ticket en caerse al cerrarlo (la animación ticket-out de basket.css). */
const CLOSE_MS = 320

const printDate = new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
const printTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`)

/**
 * Ticket de la cesta, por delante de todo: la lista de lo que hay que comprar. Cada artículo se puede marcar como
 * comprado; al cerrar el ticket, lo marcado sale de la cesta.
 */
export function Ticket({ vehicle, items, onClose }: TicketProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const finished = useRef(false)
  const [bought, setBought] = useState<ReadonlySet<string>>(() => new Set())
  const [closing, setClosing] = useState(false)
  const [printedAt] = useState(() => new Date())

  // Layout effect: al cerrarse aún está en la página y el navegador devuelve el foco a la cesta
  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.showModal()
    return () => dialog.close()
  }, [])

  const finish = () => {
    if (finished.current) return
    finished.current = true
    onClose(items.filter((item) => bought.has(item.id)).map((item) => item.id))
  }

  // El ticket se cae y, al terminar, lo comprado sale de la cesta
  useEffect(() => {
    if (!closing) return
    const timer = window.setTimeout(finish, CLOSE_MS)
    return () => window.clearTimeout(timer)
  })

  const toggle = (id: string) => {
    setBought((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const count = items.filter((item) => bought.has(item.id)).length
  const allBought = items.length > 0 && count === items.length

  return (
    <dialog
      ref={dialogRef}
      className={`ticket-dialog ${closing ? 'ticket-dialog--closing' : ''}`}
      aria-labelledby="ticket-titulo"
      // Escape: se cierra con su animación, como con el botón
      onCancel={(event) => {
        event.preventDefault()
        setClosing(true)
      }}
      // Si el navegador lo cierra por su cuenta (Escape dos veces), no se pierde lo marcado
      onClose={() => {
        if (!dialogRef.current?.open) finish()
      }}
    >
      <div
        className="ticket-wrap"
        onClick={(event) => {
          if (event.target === event.currentTarget) setClosing(true)
        }}
      >
        <div className="ticket">
          <div className="ticket__slot" aria-hidden="true" />
          <div className="ticket__feed">
            <article className="ticket__paper">
              <header className="ticket__head">
                <p className="ticket__brand">
                  Mecanic<span>AI</span>
                </p>
                <h2 className="ticket__title" id="ticket-titulo">
                  Cesta de la compra
                </h2>
                <p>
                  {vehicle.displayName}
                  {vehicle.plate && ` · ${formatPlate(vehicle.plate)}`}
                </p>
                <p className="ticket__meta">
                  <span>{printDate.format(printedAt)}</span>
                  <span>{printTime.format(printedAt)}</span>
                </p>
              </header>

              {items.length === 0 ? (
                <p className="ticket__empty">
                  *** Cesta vacía ***
                  <span>Apunta algo en el bloc y échalo a la cesta.</span>
                </p>
              ) : (
                <div className="ticket__body">
                  <ul className="ticket__lines">
                    {items.map((item, i) => {
                      const isBought = bought.has(item.id)
                      return (
                        <li key={item.id} style={{ animationDelay: `${Math.min(i, 12) * 45 + 380}ms` }}>
                          <label className={`ticket__line ${isBought ? 'ticket__line--bought' : ''}`}>
                            <input type="checkbox" checked={isBought} onChange={() => toggle(item.id)} />
                            <span className="ticket__box" aria-hidden="true">
                              <Icon name="check" size={16} />
                            </span>
                            <span className="ticket__num" aria-hidden="true">
                              {String(i + 1).padStart(2, '0')}
                            </span>
                            <span className="ticket__text">
                              <span>{item.text}</span>
                            </span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                  {allBought && (
                    <p className="ticket__stamp" aria-hidden="true">
                      ¡Todo comprado!
                    </p>
                  )}
                </div>
              )}

              {items.length > 0 && (
                <>
                  <dl className="ticket__totals">
                    <div>
                      <dt>Artículos</dt>
                      <dd>{items.length}</dd>
                    </div>
                    <div>
                      <dt>Comprados</dt>
                      <dd>{count}</dd>
                    </div>
                    <div className="ticket__total">
                      <dt>Por comprar</dt>
                      <dd>{items.length - count}</dd>
                    </div>
                  </dl>
                  <p className="ticket__note">
                    Marca lo que ya has comprado: al cerrar el ticket sale de la cesta.
                  </p>
                </>
              )}

              <footer className="ticket__foot">
                <div className="ticket__barcode" aria-hidden="true" />
                <p>¡Gracias por tu visita!</p>
              </footer>
            </article>
          </div>
        </div>

        <div className="ticket-actions">
          <p className="ticket-actions__status" role="status">
            {count > 0 ? `${plural(count, 'comprado', 'comprados')} de ${items.length}` : ''}
          </p>
          <button type="button" className="btn btn--primary btn--block" onClick={() => setClosing(true)} disabled={closing}>
            {count > 0 ? (
              <>
                <Icon name="check" size={20} /> Cerrar y sacar {plural(count, 'comprado', 'comprados')}
              </>
            ) : (
              <>
                <Icon name="close" size={20} /> Cerrar ticket
              </>
            )}
          </button>
        </div>
      </div>
    </dialog>
  )
}

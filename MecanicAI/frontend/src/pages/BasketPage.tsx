import { useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'

import { ApiError } from '../api/http.ts'
import { Icon } from '../components/Icon.tsx'
import { Wheel } from '../components/Wheel.tsx'
import { useSession } from '../context/session.ts'
import { useToast } from '../context/toast.ts'
import { useLogin } from '../context/useLogin.ts'
import { BasketBack, BasketFront } from '../features/basket/BasketArt.tsx'
import { Ticket } from '../features/basket/Ticket.tsx'
import { cleanBasketText, MAX_BASKET_TEXT, useBasket } from '../features/basket/useBasket.ts'
import { CarPlate } from '../features/garage/CarPlate.tsx'
import { GuestSaveCard } from '../features/garage/GuestSaveCard.tsx'
import { carPath } from '../features/garage/paths.ts'
import { useGarageVehicle } from '../features/garage/useGarageVehicle.ts'
import '../features/basket/basket.css'
import './pages.css'

/** Ejemplos que se van turnando en el bloc de notas. */
const EXAMPLES = [
  'Aceite 5W30, 5 litros',
  'Pastillas de freno delanteras',
  'Escobillas del limpiaparabrisas',
  'Filtro de habitáculo',
  'Bombilla H7',
  'Líquido refrigerante',
]

/** Papel que vuela del bloc a la cesta. Mientras está en el aire, su artículo aún no se cuenta en la cesta. */
interface Flyer {
  key: number
  text: string
  /** null hasta que el artículo está guardado. */
  itemId: string | null
  /** De dónde sale (respecto a la cesta) y cuánto se mueve hasta caer dentro, en px. */
  x: number
  y: number
  dx: number
  dy: number
  spin: number
}

const SPARKS = Array.from({ length: 9 }, (_, i) => ({ angle: -80 + i * 20, reach: 30 + (i % 3) * 14 }))

const noMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Cesta de un coche: se apunta en el bloc lo que hay que comprar, cae en la cesta y, al tocarla, sale el ticket. */
export function BasketPage() {
  const { me } = useSession()
  const vehicle = useGarageVehicle()
  const { items, add, removeBought, max } = useBasket()
  const toast = useToast()
  const [text, setText] = useState('')
  const [flyers, setFlyers] = useState<Flyer[]>([])
  const [bursts, setBursts] = useState<number[]>([])
  const [added, setAdded] = useState(0)
  const [ticketOpen, setTicketOpen] = useState(false)
  const nextKey = useRef(0)
  const padRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const basketRef = useRef<HTMLDivElement>(null)

  if (!me) return null
  if (!vehicle) return <Navigate to="/" replace />
  if (items === null) {
    return (
      <div className="center-screen" aria-busy="true">
        <Wheel size={64} spinning title="Cargando" />
      </div>
    )
  }

  const flying = new Set(flyers.map((f) => f.itemId))
  // Lo que ya está dentro de la cesta: lo que aún vuela no se cuenta hasta que cae
  const inBasket = items.filter((item) => item.vehicleId === vehicle.id && !flying.has(item.id))
  const full = max > 0 && items.length >= max

  const shake = (element: Element | null) => {
    if (noMotion()) return
    element?.animate(
      [{ translate: '0' }, { translate: '-7px' }, { translate: '6px' }, { translate: '-4px' }, { translate: '0' }],
      { duration: 320, easing: 'ease-out' },
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const clean = cleanBasketText(text)
    const input = inputRef.current
    const basket = basketRef.current
    if (!clean || !input || !basket) {
      shake(padRef.current)
      input?.focus()
      return
    }

    // El papel sale de donde se ha escrito y cae dentro de la boca de la cesta
    const from = input.getBoundingClientRect()
    const to = basket.getBoundingClientRect()
    const x = from.left + Math.min(from.width / 2, 110) - to.left
    const y = from.top + from.height / 2 - to.top
    const key = nextKey.current++
    const flyer: Flyer = { key, text: clean, itemId: null, x, y, dx: to.width / 2 - x, dy: to.height * 0.6 - y, spin: key % 2 ? -1 : 1 }
    setFlyers((list) => [...list, flyer])
    setText('')
    setAdded((n) => n + 1)
    input.focus()

    try {
      await add(vehicle.id, clean, (item) => {
        setFlyers((list) => list.map((f) => (f.key === key ? { ...f, itemId: item.id } : f)))
      })
    } catch (error) {
      setFlyers((list) => list.filter((f) => f.key !== key))
      // Se le devuelve lo escrito (si no ha empezado ya a escribir otra cosa)
      setText((current) => current || clean)
      toast(error instanceof ApiError ? error.message : 'No se pudo añadir a la cesta.', 'error')
    }
  }

  // El papel ha caído dentro: la cesta bota, saltan chispas y el artículo ya cuenta
  const landed = (key: number) => {
    setFlyers((list) => list.filter((f) => f.key !== key))
    setBursts((list) => [...list, key])
    window.setTimeout(() => setBursts((list) => list.filter((k) => k !== key)), 700)
    if (noMotion()) return
    for (const layer of basketRef.current?.querySelectorAll('.basket__svg') ?? []) {
      layer.animate(
        [
          { transform: 'none' },
          { transform: 'translateY(7px) scale(1.04, 0.93)', offset: 0.25 },
          { transform: 'translateY(-5px) scale(0.98, 1.03)', offset: 0.55 },
          { transform: 'translateY(2px) scale(1.01, 0.99)', offset: 0.8 },
          { transform: 'none' },
        ],
        { duration: 520, easing: 'ease-out' },
      )
    }
  }

  const closeTicket = async (boughtIds: string[]) => {
    setTicketOpen(false)
    if (boughtIds.length === 0) return
    try {
      await removeBought(boughtIds)
      toast(
        boughtIds.length === 1 ? '1 artículo comprado: ya no está en la cesta' : `${boughtIds.length} artículos comprados: ya no están en la cesta`,
        'success',
      )
    } catch (error) {
      toast(error instanceof ApiError ? error.message : 'No se pudo sacar de la cesta lo comprado. Inténtalo de nuevo.', 'error')
    }
  }

  const count = inBasket.length
  const countText = count === 1 ? '1 artículo' : `${count} artículos`

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Cesta</p>
        <h1 className="page-title">Lista de la compra</h1>
      </header>

      <CarPlate
        vehicle={vehicle}
        action={
          <Link to={carPath(vehicle.id)} className="btn btn--ghost btn--xs">
            <Icon name="back" size={16} /> Volver
          </Link>
        }
      />

      

      <section className="plate basket-stage" aria-label="Cesta">
        {full ? (
          <p className="notice">
            <Icon name="alert" size={20} />
            <span>
              Tu cesta está llena ({max} artículos entre todos tus coches). Marca alguno como comprado en el ticket para
              añadir otro.
            </span>
          </p>
        ) : (
          <form className="basket-form" onSubmit={(event) => void submit(event)}>
            <div className="pad" ref={padRef}>
              <span className="pad__rings" aria-hidden="true" />
              <label className="pad__title" htmlFor="cesta-articulo">
                ¿Qué le hace falta?
              </label>
              <input
                id="cesta-articulo"
                ref={inputRef}
                className="pad__input"
                value={text}
                onChange={(event) => setText(event.target.value)}
                maxLength={MAX_BASKET_TEXT}
                placeholder={EXAMPLES[added % EXAMPLES.length]}
                autoComplete="off"
                enterKeyHint="done"
              />
              <span className="pad__count" aria-hidden="true">
                {text.length}/{MAX_BASKET_TEXT}
              </span>
            </div>
            <button type="submit" className="btn btn--primary btn--block basket-form__add">
              <Icon name="basket" size={20} /> Añadir a la cesta
            </button>
          </form>
        )}

        <div className="basket" ref={basketRef}>
          <BasketBack items={inBasket} />
          <div className="basket__flyers" aria-hidden="true">
            {flyers.map((flyer) => (
              <span
                key={flyer.key}
                className="flyer"
                style={
                  {
                    left: flyer.x,
                    top: flyer.y,
                    '--dx': `${flyer.dx}px`,
                    '--dy': `${flyer.dy}px`,
                    '--spin': flyer.spin,
                  } as CSSProperties
                }
                onAnimationEnd={(event) => {
                  if (event.target === event.currentTarget) landed(flyer.key)
                }}
              >
                <span className="flyer__fall">
                  <span className="flyer__slip">{flyer.text}</span>
                </span>
              </span>
            ))}
          </div>
          <BasketFront />
          <div className="basket__sparks" aria-hidden="true">
            {bursts.map((key) => (
              <span key={key} className="sparks">
                {SPARKS.map(({ angle, reach }) => (
                  <i key={angle} style={{ '--angle': `${angle}deg`, '--reach': `${reach}px` } as CSSProperties} />
                ))}
              </span>
            ))}
          </div>
          <div className="basket__tag" aria-hidden="true">
            <span className="basket__label">
              <span key={count} className="basket__count">
                {count}
              </span>
              <span className="basket__unit">{count === 1 ? 'artículo' : 'artículos'}</span>
            </span>
          </div>
          <button
            type="button"
            className="basket__open"
            onClick={() => setTicketOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Ver el ticket de la cesta: ${countText}`}
          />
        </div>

        <p className={`basket-hint ${count > 0 ? 'basket-hint--ready' : ''}`}>
          {count > 0 ? (
            <>
              <svg viewBox="0 0 40 34" width="34" height="29" aria-hidden="true" focusable="false">
                <path d="M33 31C30 18 22 10 9 7M9 7l9 7M9 7l10-4" />
              </svg>
              Toca la cesta para sacar el ticket
            </>
          ) : (
            'La cesta está vacía: apunta algo y échalo dentro'
          )}
        </p>
        <p className="basket-status" role="status">
          {`En la cesta: ${countText}`}
        </p>
      </section>

      <p className="muted small">
        Puedes tener hasta {max} artículos en la cesta entre todos tus coches
        {items.length > 0 ? ` (llevas ${items.length})` : ''}.
        {!me.authenticated && count > 0 && ' Como invitado, se borran al cerrar la página.'}
      </p>

      {!me.authenticated && count > 0 && <GuestSaveCard />}

      {ticketOpen && <Ticket vehicle={vehicle} items={inBasket} onClose={(ids) => void closeTicket(ids)} />}
    </div>
  )
}



import type { ReactNode } from 'react'

import type { VehicleSpec } from '../../api/types.ts'
import { Hubcap } from '../../components/Hubcap.tsx'
import { brandAbbr, displayName, engineLabel, formatPlate } from '../../lib/vehicle.ts'
import './garage.css'

interface CarPlateProps {
  vehicle: VehicleSpec
  /** Botón o enlace a la derecha (p. ej. volver). */
  action?: ReactNode
  size?: 'sm' | 'lg'
}

/** Placa con el coche elegido: tapacubos, nombre y motorización (y, en la grande, su matrícula si la tiene). */
export function CarPlate({ vehicle, action, size = 'sm' }: CarPlateProps) {
  const engine = engineLabel(vehicle)
  return (
    <div className={`plate car-plate car-plate--${size}`}>
      <Hubcap label={brandAbbr(vehicle.brand)} size={size === 'lg' ? 'lg' : 'sm'} />
      <span className="car-plate__text">
        <strong>{size === 'lg' ? `${vehicle.brand} ${vehicle.model}` : displayName(vehicle)}</strong>
        {size === 'lg' ? (
          <span>
            {vehicle.year}
            {engine ? ` · ${engine}` : ''}
          </span>
        ) : (
          engine && <span>{engine}</span>
        )}
        {size === 'lg' && vehicle.plate && (
          <span className="car-plate__reg" title="Matrícula">
            {formatPlate(vehicle.plate)}
          </span>
        )}
      </span>
      {action}
    </div>
  )
}

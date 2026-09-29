import { createContext, useContext } from 'react'

export type ToastTone = 'info' | 'success' | 'error'

export type ShowToast = (message: string, tone?: ToastTone) => void

export const ToastContext = createContext<ShowToast>(() => {})

/** Muestra un aviso breve en la parte superior de la pantalla. */
export function useToast(): ShowToast {
  return useContext(ToastContext)
}

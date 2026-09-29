import { useCallback, useState, type ReactNode } from 'react'

import { ToastContext, type ShowToast, type ToastTone } from './toast.ts'

interface Toast {
  id: number
  message: string
  tone: ToastTone
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback<ShowToast>((message, tone = 'info') => {
    const id = nextId++
    setToasts((current) => [...current.filter((t) => t.message !== message), { id, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4500)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import Icon, { type IconName } from '../shared/Icon'

export type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  show: (message: string, tone?: ToastTone) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

const toneIcon: Record<ToastTone, IconName> = {
  success: 'check-circle',
  error: 'alert',
  info: 'info',
  warning: 'warning',
}

const toneClasses: Record<ToastTone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-red-200 bg-red-50 text-red-900',
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)
  const timers = useRef<number[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id))
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = nextId.current++
      setToasts((current) => [...current.slice(-2), { id, tone, message }])
      const timer = window.setTimeout(() => dismiss(id), 3000)
      timers.current.push(timer)
    },
    [dismiss],
  )

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show(message, 'success'),
      error: (message: string) => show(message, 'error'),
      info: (message: string) => show(message, 'info'),
      warning: (message: string) => show(message, 'warning'),
    }),
    [show],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed left-1/2 bottom-6 -translate-x-1/2 flex flex-col gap-2 z-50 w-[min(420px,calc(100vw-32px))] pointer-events-none"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 p-3.5 rounded-lg border shadow-lg text-sm font-medium transition-all duration-200',
              toneClasses[toast.tone],
            )}
          >
            <Icon name={toneIcon[toast.tone]} size={16} />
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              className="ml-auto p-1 opacity-60 hover:opacity-100 transition-opacity"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

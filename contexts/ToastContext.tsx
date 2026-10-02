import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { AlertSeverity } from '../data/types'

export interface Toast {
  id: number
  severity: AlertSeverity
  title: string
  message?: string
}

interface ToastCtx {
  toasts: Toast[]
  push: (severity: AlertSeverity, title: string, message?: string) => void
  dismiss: (id: number) => void
}

const Ctx = createContext<ToastCtx | null>(null)
let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef(new Map<number, number>())

  const dismiss = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
  }, [])

  const push = useCallback(
    (severity: AlertSeverity, title: string, message?: string) => {
      const id = nextId++
      setToasts((ts) => [...ts.slice(-2), { id, severity, title, message }])
      const timer = setTimeout(() => dismiss(id), 3400) as unknown as number
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

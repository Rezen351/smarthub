import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

/**
 * Session context (laporan.pdf §9.7).
 *
 * The operator's active farmer/pallet/grade is the most critical piece of UI
 * state: weighing the wrong pallet records data against the wrong entity.
 * The context bar stays sticky under the navbar, shows a TTL progress line,
 * and can only be cleared through a confirmation dialog.
 */

export interface SessionContextValue {
  farmer: { id: string; name: string } | null
  pallet: { code: string; harvestDate: string } | null
  defaultGrade: string | null
  active: boolean
  remainingMs: number
  offline: boolean
  setOffline: (offline: boolean) => void
  /** Called after a successful scan of the farmer ID. */
  startScan: (farmer: { id: string; name: string }, palletCode: string, harvestDate: string, grade?: string) => void
  reset: () => void
  extend: () => void
}

const TTL_MS = 4 * 60 * 60 * 1000
const STORAGE_KEY = 'enyx.session-context'

interface StoredContext {
  farmer: { id: string; name: string }
  pallet: { code: string; harvestDate: string }
  defaultGrade: string | null
  expiresAt: number
}

const SessionContextContext = createContext<SessionContextValue | undefined>(undefined)

function readStored(): StoredContext | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredContext
    if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) {
      sessionStorage.removeItem(STORAGE_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function SessionContextProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<StoredContext | null>(() => readStored())
  const [offline, setOffline] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  /* TTL countdown tick */
  useEffect(() => {
    if (!stored) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [stored])

  /* Expire the context when the TTL runs out */
  useEffect(() => {
    if (stored && now >= stored.expiresAt) {
      setStored(null)
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [now, stored])

  const persist = useCallback((value: StoredContext | null) => {
    setStored(value)
    if (value) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } else {
      sessionStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const startScan = useCallback<SessionContextValue['startScan']>(
    (farmer, palletCode, harvestDate, grade) => {
      persist({
        farmer,
        pallet: { code: palletCode, harvestDate },
        defaultGrade: grade ?? null,
        expiresAt: Date.now() + TTL_MS,
      })
      setNow(Date.now())
    },
    [persist],
  )

  const reset = useCallback(() => {
    persist(null)
    setNow(Date.now())
  }, [persist])

  const extend = useCallback(() => {
    setStored((current) => {
      if (!current) return current
      const next = { ...current, expiresAt: Date.now() + TTL_MS }
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const value = useMemo<SessionContextValue>(
    () => ({
      farmer: stored?.farmer ?? null,
      pallet: stored?.pallet ?? null,
      defaultGrade: stored?.defaultGrade ?? null,
      active: Boolean(stored),
      remainingMs: stored ? Math.max(0, stored.expiresAt - now) : 0,
      offline,
      setOffline,
      startScan,
      reset,
      extend,
    }),
    [stored, now, offline, startScan, reset, extend],
  )

  return <SessionContextContext.Provider value={value}>{children}</SessionContextContext.Provider>
}

export function useSessionContext() {
  const context = useContext(SessionContextContext)
  if (!context) {
    throw new Error('useSessionContext must be used within a SessionContextProvider')
  }
  return context
}

export const SESSION_TTL_MS = TTL_MS

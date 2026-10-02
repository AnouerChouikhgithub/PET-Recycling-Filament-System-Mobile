/**
 * Authentication context — the ONE place handling login state, secure token
 * storage and session restoration for the whole mobile app.
 *
 * Flow: login → POST /api/auth/login → JWT in expo-secure-store →
 * GET /api/me on boot to restore the session → app renders.
 * 401s from any API call funnel here through client.setUnauthorizedHandler.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { authApi } from '../api'
import { ApiError, AUTH_ERROR_EVENT, getToken, setUnauthorizedHandler } from '../api/client'
import type { User } from '../data/api'

interface AuthContextValue {
  user: User | null
  /** Restoring the session from the secure store. */
  initializing: boolean
  loginInProgress: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
}

const Ctx = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [loginInProgress, setLoginInProgress] = useState(false)
  const bootstrapped = useRef(false)

  const logout = useCallback(async () => {
    await authApi.logout()
    setUser(null)
  }, [])

  // 401s raised anywhere in the app end up here — single logout path.
  // (React Native has no window event system: the client calls the registered
  // handler directly. AUTH_ERROR_EVENT stays as a web-parity constant.)
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void logout()
    })
    void AUTH_ERROR_EVENT
    return () => {
      setUnauthorizedHandler(null)
    }
  }, [logout])

  // Session restoration: a stored token is validated against /api/me.
  useEffect(() => {
    if (bootstrapped.current) return
    bootstrapped.current = true

    void (async () => {
      const token = await getToken()
      if (!token) {
        setInitializing(false)
        return
      }
      try {
        const me = await authApi.me()
        setUser(me)
      } catch {
        // expired/invalid token — client already cleared it
        setUser(null)
      } finally {
        setInitializing(false)
      }
    })()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setLoginInProgress(true)
    try {
      const payload = await authApi.login(email, password)
      setUser(payload.user)
    } finally {
      setLoginInProgress(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    setLoginInProgress(true)
    try {
      const payload = await authApi.register(email, password, name)
      setUser(payload.user)
    } finally {
      setLoginInProgress(false)
    }
  }, [])

  const value = useMemo(
    () => ({ user, initializing, loginInProgress, login, register, logout }),
    [user, initializing, loginInProgress, login, register, logout],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** True when the error is invalid credentials (vs. network/server issues). */
export function isCredentialsError(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'INVALID_CREDENTIALS' || err.status === 401)
}

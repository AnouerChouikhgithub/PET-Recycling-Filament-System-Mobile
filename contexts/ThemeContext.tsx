import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useColorScheme } from 'react-native'
import { StatusBar } from 'expo-status-bar'

import { themes } from '../theme/tokens'
import type { AppTheme } from '../theme/tokens'
import { storage } from '../lib/storage'
import type { ThemeMode } from '../data/types'

interface ThemeCtx {
  mode: ThemeMode
  resolved: 'light' | 'dark'
  theme: AppTheme
  setMode: (m: ThemeMode) => void
  toggle: () => void
}

const Ctx = createContext<ThemeCtx | null>(null)
const STORAGE_KEY = '3awedlou-theme-mode'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme()
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    storage.getString(STORAGE_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'system') setModeState(v)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (loaded) storage.setString(STORAGE_KEY, mode)
  }, [mode, loaded])

  const resolved: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode

  const value = useMemo<ThemeCtx>(
    () => ({
      mode,
      resolved,
      theme: themes[resolved],
      setMode: setModeState,
      toggle: () => setModeState((m: ThemeMode) => (m === 'dark' ? 'light' : 'dark')),
    }),
    [mode, resolved],
  )

  return (
    <Ctx.Provider value={value}>
      {children}
      {/* Status bar icons follow the active theme */}
      <StatusBar style={resolved === 'dark' ? 'light' : 'dark'} />
    </Ctx.Provider>
  )
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}

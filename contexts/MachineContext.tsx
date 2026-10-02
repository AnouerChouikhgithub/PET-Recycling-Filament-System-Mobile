/**
 * Machine data context (mobile) — backed by the Symfony API.
 *
 * This is the single seam between the screens and the backend. It preserves
 * the useMachine() interface the screens were built against (machine, alerts,
 * sessions, currentSession, start/pause/resume/stop …) but every value now
 * comes from the API instead of the client-side simulation:
 *
 *   AuthProvider resolves → MachineProvider loads /machines + /dashboard
 *   → realtimeService subscription (polling today, WebSocket later)
 *   → useMachine() feeds Home, Machine, Recycling, Impact, Profile pages.
 *
 * Sensor/subsystem view models are DERIVED from real telemetry; when a channel
 * has no data the UI shows zeros/empties — nothing is fabricated.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import { machinesApi, sendMachineCommand } from '../api'
import { realtimeService } from '../realtime/realtimeService'
import { useAuth } from './AuthContext'
import { timeAgo } from '../lib/format'
import type {
  Machine,
  MachineAlert,
  MachineCommandType,
  MachineDashboardView,
  MachineSession,
  MachineTelemetry,
  RecyclingTotals,
} from '../data/api'

export interface SensorReading {
  id: 'temp' | 'motor' | 'fan' | 'feed'
  label: string
  shortLabel: string
  unit: string
  value: number
  target: number
  status: 'nominal' | 'warning' | 'error'
  history: number[]
  min: number
  max: number
  decimals?: number
}

export interface Subsystem {
  key: 'heater' | 'motor' | 'cooling' | 'spooler'
  label: string
  detail: string
  state: 'on' | 'off' | 'fault'
}

interface MachineCtx {
  /** True once the initial machine list load resolves. */
  ready: boolean
  loading: boolean
  error: string | null
  machine: MachineState
  sensors: SensorReading[]
  subsystems: Subsystem[]
  alerts: MachineAlert[]
  sessions: MachineSession[]
  currentSession: MachineSession | null
  unreadAlerts: number
  /** 'polling' until the realtime transport is deployed */
  realtimeMode: 'websocket' | 'polling'
  machines: Machine[]
  selectedId: string | null
  selectMachine: (id: string) => void
  refresh: () => void
  telemetry: MachineTelemetry | null
  recentTelemetry: MachineTelemetry[]
  recyclingTotals: RecyclingTotals
  startSession: (args: { petInputG: number; operator: string }) => Promise<void>
  pauseSession: () => Promise<void>
  resumeSession: () => Promise<void>
  stopSession: () => Promise<void>
  sendCommand: (command: MachineCommandType, value?: number) => Promise<void>
  markAlertRead: (id: string) => void
  markAllAlertsRead: () => void
}

/** Backwards-compatible shape used by screens written for the demo. */
export interface MachineState {
  status: 'idle' | 'heating' | 'extruding' | 'paused' | 'error' | 'offline'
  connected: boolean
  deviceName: string
  firmware: string
  currentSessionId: string | null
  petInputG: number
  petProcessedG: number
  lastSessionId: number
  /** Human-readable lastSeenAt, resolved by the provider. */
  lastSeenLabel: string
}

const Ctx = createContext<MachineCtx | null>(null)

const TEMP_TARGET_FALLBACK = 195

const deviation = (value: number, ref: number) => Math.abs(value - ref) / Math.max(1, Math.abs(ref))

function buildSensors(view: MachineDashboardView): SensorReading[] {
  const t = view.telemetry
  const historyOf = (pick: (s: MachineTelemetry) => number | null): number[] =>
    view.recentTelemetry.map(pick).filter((v): v is number => v !== null).slice(-24)

  const target = t?.targetTemperature ?? TEMP_TARGET_FALLBACK
  const tempValue = t?.temperature ?? 0
  const tempStatus: SensorReading['status'] =
    t?.temperature == null
      ? 'nominal'
      : deviation(t.temperature, target) > 0.18
        ? 'error'
        : deviation(t.temperature, target) > 0.09
          ? 'warning'
          : 'nominal'

  return [
    {
      id: 'temp',
      label: 'Extruder Temp',
      shortLabel: 'Extruder',
      unit: '°C',
      value: tempValue,
      target,
      status: tempStatus,
      history: historyOf((s) => s.temperature),
      min: 0,
      max: 300,
    },
    {
      id: 'motor',
      label: 'Motor Speed',
      shortLabel: 'Motor',
      unit: 'RPM',
      value: t?.motorSpeed ?? 0,
      target: t?.motorSpeed ?? 0,
      status: 'nominal',
      history: historyOf((s) => s.motorSpeed),
      min: 0,
      max: 100,
    },
    {
      id: 'fan',
      label: 'Cooling Fan',
      shortLabel: 'Cooling',
      unit: '%',
      value: t?.fanState ? 100 : 0,
      target: t?.fanState ? 100 : 0,
      status: 'nominal',
      history: historyOf((s) => (s.fanState ? 100 : 0)),
      min: 0,
      max: 100,
    },
    {
      id: 'feed',
      label: 'Feed Rate',
      shortLabel: 'Feed',
      unit: 'mm/s',
      value: t?.filamentSpeed ?? 0,
      target: t?.filamentSpeed ?? 0,
      status: 'nominal',
      history: historyOf((s) => s.filamentSpeed),
      min: 0,
      max: 6,
      decimals: 1,
    },
  ]
}

function buildSubsystems(view: MachineDashboardView): Subsystem[] {
  const t = view.telemetry
  const offline = view.status === 'offline'
  const running = !offline && view.activeSession != null
  return [
    {
      key: 'heater',
      label: 'Heater',
      detail: t?.targetTemperature != null ? `Target ${Math.round(t.targetTemperature)}°C` : 'Standby',
      state: !offline && (t?.heaterState ?? false) ? 'on' : 'off',
    },
    {
      key: 'motor',
      label: 'Extruder Motor',
      detail: t?.motorSpeed != null ? `${Math.round(t.motorSpeed)} RPM` : 'Standby',
      state: !offline && (t?.motorState ?? false) ? 'on' : 'off',
    },
    {
      key: 'cooling',
      label: 'Cooling',
      detail: t?.fanState != null ? `Fan ${t.fanState ? 'on' : 'off'}` : 'Standby',
      state: !offline && (t?.fanState ?? false) ? 'on' : 'off',
    },
    {
      key: 'spooler',
      label: 'Spooler',
      detail: running ? 'Session in progress' : 'Idle',
      state: running ? 'on' : 'off',
    },
  ]
}

export function MachineProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()

  const [machines, setMachines] = useState<Machine[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<MachineDashboardView | null>(null)
  const [sessions, setSessions] = useState<MachineSession[]>([])
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readIds, setReadIds] = useState<string[]>([])
  const [historyAlerts, setHistoryAlerts] = useState<MachineAlert[]>([])

  const selectedRef = useRef<string | null>(null)
  useEffect(() => {
    selectedRef.current = selectedId
  }, [selectedId])

  const refreshDashboard = useCallback((id: string): void => {
    machinesApi
      .dashboard(id)
      .then(setDashboard)
      .catch(() => {})
  }, [])

  /* -------- initial load -------- */
  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const list = await machinesApi.list()
      setMachines(list)
      if (list.length === 0) {
        setSelectedId(null)
        setDashboard(null)
        return
      }
      const id = selectedRef.current ?? (list.find((m) => m.status !== 'offline') ?? list[0]).id
      setSelectedId(id)
      const data = await machinesApi.dashboard(id)
      setDashboard(data)
      const history = await machinesApi.sessions(id, { limit: 50 })
      setSessions(history)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [user?.id, load])

  /* -------- realtime subscription (polling transport today) -------- */
  useEffect(() => {
    if (!selectedId) return
    const offTelemetry = realtimeService.onTelemetry((_telemetry, dash) => {
      setDashboard(dash)
    })
    realtimeService.subscribeToMachine(selectedId)
    return () => {
      offTelemetry()
      realtimeService.unsubscribe()
    }
  }, [selectedId])

  /* -------- alerts derived from REAL machine state -------- */
  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    machinesApi
      .sessions(selectedId, { limit: 20 })
      .then((all) => {
        if (cancelled) return
        const failedAlerts = all
          .filter((s) => s.status === 'failed')
          .slice(0, 3)
          .map((s): MachineAlert => ({
            id: `session-failed-${s.id}`,
            severity: 'error',
            title: 'Session failed',
            message: s.notes ?? 'A recent session ended unexpectedly.',
            date: s.endedAt ?? s.startedAt,
            read: false,
          }))
        const completed = all.find((s) => s.status === 'completed')
        const completedAlert: MachineAlert | null = completed
          ? {
              id: `session-completed-${completed.id}`,
              severity: 'success',
              title: 'Session completed',
              message:
                completed.materialOutput != null
                  ? `Filament output recorded: ${Math.round(completed.materialOutput)} g.`
                  : 'The run finished and was archived.',
              date: completed.endedAt ?? completed.startedAt,
              read: false,
            }
          : null
        setHistoryAlerts([...failedAlerts, ...(completedAlert ? [completedAlert] : [])])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedId, dashboard])

  const markAlertRead = useCallback((id: string) => setReadIds((ids) => (ids.includes(id) ? ids : [...ids, id])), [])
  const markAllAlertsRead = useCallback(
    () => setReadIds((ids) => Array.from(new Set([...ids]))),
    [],
  )

  /* -------- commands -------- */
  const sendCommand = useCallback(
    async (command: MachineCommandType, value?: number): Promise<void> => {
      const id = selectedRef.current
      if (!id) throw new Error('No machine selected.')
      try {
        await sendMachineCommand(id, command, value)
      } finally {
        refreshDashboard(id)
      }
    },
    [refreshDashboard],
  )

  const startSession = useCallback(
    async ({ petInputG }: { petInputG: number; operator: string }) => {
      // The guarded 'start' command begins the machine's run; the PET amount is
      // recorded with the session by the firmware layer when hardware lands.
      await sendCommand('start')
      void petInputG
    },
    [sendCommand],
  )
  const pauseSession = useCallback(async () => sendCommand('pause'), [sendCommand])
  const resumeSession = useCallback(async () => sendCommand('resume'), [sendCommand])
  const stopSession = useCallback(async () => sendCommand('stop'), [sendCommand])

  const refresh = useCallback(() => {
    const id = selectedRef.current
    if (id) refreshDashboard(id)
  }, [refreshDashboard])

  const selectMachine = useCallback(
    (id: string) => {
      setSelectedId(id)
      refreshDashboard(id)
      machinesApi
        .sessions(id, { limit: 50 })
        .then(setSessions)
        .catch(() => {})
    },
    [refreshDashboard],
  )

  /* -------- view models -------- */
  const sensors = useMemo(() => (dashboard ? buildSensors(dashboard) : []), [dashboard])
  const subsystems = useMemo(() => (dashboard ? buildSubsystems(dashboard) : []), [dashboard])

  const machine: MachineState = useMemo(
    () => ({
      status: dashboard?.status ?? 'offline',
      connected: dashboard ? dashboard.status !== 'offline' : false,
      deviceName: dashboard?.identifier ?? '—',
      firmware: 'managed by backend',
      currentSessionId: dashboard?.activeSession?.id ?? null,
      petInputG: Math.round(dashboard?.activeSession?.materialInput ?? 0),
      // Only real measurements count: output is null until the machine ends the run.
      petProcessedG: 0,
      lastSessionId: sessions.length,
      lastSeenLabel: dashboard?.lastSeenAt
        ? timeAgo(dashboard.lastSeenAt)
        : 'never reported',
    }),
    [dashboard, sessions.length],
  )

  const currentSession = useMemo(() => {
    if (!dashboard?.activeSession) return null
    return dashboard.activeSession
  }, [dashboard])

  const alerts = useMemo(() => {
    const derived: MachineAlert[] = []
    if (dashboard?.status === 'offline') {
      derived.push({
        id: 'machine-offline',
        severity: 'error',
        title: 'Machine offline',
        message: 'The machine has not reported recently. Check its Wi-Fi connection.',
        date: new Date().toISOString(),
        read: false,
      })
    }
    if (dashboard?.activeSession?.status === 'in_progress') {
      derived.push({
        id: 'session-running',
        severity: 'info',
        title: 'Session in progress',
        message: 'The machine is recycling PET into filament right now.',
        date: dashboard.activeSession.startedAt,
        read: false,
      })
    }
    return [...historyAlerts, ...derived].sort((a, b) => b.date.localeCompare(a.date))
  }, [dashboard, historyAlerts])

  const alertsView = useMemo(
    () => alerts.map((a) => ({ ...a, read: readIds.includes(a.id) })),
    [alerts, readIds],
  )

  const value = useMemo<MachineCtx>(
    () => ({
      ready,
      loading,
      error,
      machine,
      sensors,
      subsystems,
      alerts: alertsView,
      sessions,
      currentSession,
      unreadAlerts: alertsView.filter((a) => !a.read).length,
      realtimeMode: realtimeService.mode,
      machines,
      selectedId,
      selectMachine,
      refresh,
      telemetry: dashboard?.telemetry ?? null,
      recentTelemetry: dashboard?.recentTelemetry ?? [],
      recyclingTotals:
        dashboard?.recyclingTotals ?? { records: 0, inputGrams: null, outputGrams: null },
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      sendCommand,
      markAlertRead,
      markAllAlertsRead,
    }),
    [
      ready,
      loading,
      error,
      machine,
      sensors,
      subsystems,
      alertsView,
      sessions,
      currentSession,
      machines,
      selectedId,
      selectMachine,
      refresh,
      dashboard,
      startSession,
      pauseSession,
      resumeSession,
      stopSession,
      sendCommand,
      markAlertRead,
      markAllAlertsRead,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useMachine(): MachineCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useMachine must be used within MachineProvider')
  return ctx
}

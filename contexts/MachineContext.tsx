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
 * Sensor/subsystem view models preserve null and freshness: absent channels
 * render as unreported, never as fabricated zero/off values.
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
import type { MachineCommandResult } from '../data/api'
import { realtimeService } from '../realtime/realtimeService'
import { useAuth } from './AuthContext'
import { timeAgo } from '../lib/format'
import { markAllAsRead, countUnread } from '../lib/alerts'
import { buildSensors, buildSubsystems } from '../lib/machineView'
import type { SensorReading, Subsystem } from '../lib/machineView'
import type {
  Machine,
  MachineAlert,
  MachineCommandType,
  MachineDashboardView,
  MachineSession,
  MachineTelemetry,
  RecyclingTotals,
} from '../data/api'

export type { SensorReading, Subsystem } from '../lib/machineView'

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
  startSession: (args: { petInputG: number; operator: string }) => Promise<MachineCommandResult>
  pauseSession: () => Promise<MachineCommandResult>
  resumeSession: () => Promise<MachineCommandResult>
  stopSession: () => Promise<MachineCommandResult>
  sendCommand: (command: MachineCommandType, value?: number) => Promise<MachineCommandResult>
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

  /* -------- commands -------- */
  const sendCommand = useCallback(
    async (command: MachineCommandType, value?: number): Promise<MachineCommandResult> => {
      const id = selectedRef.current
      if (!id) throw new Error('No machine selected.')
      try {
        return await sendMachineCommand(id, command, value)
      } finally {
        refreshDashboard(id)
      }
    },
    [refreshDashboard],
  )

  const startSession = useCallback(
    async ({ petInputG }: { petInputG: number; operator: string }): Promise<MachineCommandResult> => {
      // The guarded 'start' command begins the machine's run; the PET amount is
      // recorded with the session by the firmware layer when hardware lands.
      const result = await sendCommand('start')
      void petInputG
      return result
    },
    [sendCommand],
  )
  const pauseSession = useCallback(() => sendCommand('pause'), [sendCommand])
  const resumeSession = useCallback(() => sendCommand('resume'), [sendCommand])
  const stopSession = useCallback(() => sendCommand('stop'), [sendCommand])

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
      firmware: 'Not reported',
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
        message: 'A recycling session is marked in progress. Confirm physical activity from fresh telemetry.',
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
  const markAllAlertsRead = useCallback(
    () => setReadIds((ids) => markAllAsRead(ids, alerts.map((alert) => alert.id))),
    [alerts],
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
      unreadAlerts: countUnread(alertsView, readIds),
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
      readIds,
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

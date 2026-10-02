/**
 * 3awedlou realtime service (mobile).
 *
 * Same conceptual interface as web-app/src/realtime/realtimeService.ts —
 * the transport (WebSocket/SSE) is not deployed yet, so the service runs in
 * honest polling mode and surfaces that fact to the UI. When the backend
 * realtime hub ships, only this file changes; screens keep their interface.
 */
import { machinesApi } from '../api'
import type { MachineDashboardView, MachineTelemetry } from '../data/api'

export type RealtimeTransport = 'websocket' | 'polling'

export interface RealtimeHandlers {
  onTelemetry?: (telemetry: MachineTelemetry | null, dashboard: MachineDashboardView) => void
  onMachineStatus?: (dashboard: MachineDashboardView) => void
  onMachineEvent?: (event: { type: string; payload: Record<string, unknown>; occurredAt: string }) => void
}

const REFRESH_MS = 10_000

class RealtimeService {
  private handlers: RealtimeHandlers = {}
  private machineId: string | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private inFlight = false
  private transport: RealtimeTransport = process.env.EXPO_PUBLIC_REALTIME_URL ? 'websocket' : 'polling'

  get mode(): RealtimeTransport {
    return this.transport
  }

  get isRunning(): boolean {
    return this.running
  }

  /** No-op until the WebSocket hub exists — kept for interface stability. */
  connect(_url?: string): void {}

  disconnect(): void {
    this.stopPolling()
    this.running = false
  }

  subscribeToMachine(machineId: string): void {
    if (this.machineId === machineId && this.running) return
    this.stopPolling()
    this.machineId = machineId
    this.running = true
    if (this.transport === 'polling') this.startPolling()
  }

  unsubscribe(): void {
    this.stopPolling()
    this.machineId = null
    this.running = false
  }

  onTelemetry(cb: NonNullable<RealtimeHandlers['onTelemetry']>): () => void {
    this.handlers.onTelemetry = cb
    return () => {
      if (this.handlers.onTelemetry === cb) delete this.handlers.onTelemetry
    }
  }

  onMachineStatus(cb: NonNullable<RealtimeHandlers['onMachineStatus']>): () => void {
    this.handlers.onMachineStatus = cb
    return () => {
      if (this.handlers.onMachineStatus === cb) delete this.handlers.onMachineStatus
    }
  }

  onMachineEvent(cb: NonNullable<RealtimeHandlers['onMachineEvent']>): () => void {
    this.handlers.onMachineEvent = cb
    return () => {
      if (this.handlers.onMachineEvent === cb) delete this.handlers.onMachineEvent
    }
  }

  /** One immediate refresh — used after user actions. */
  refreshNow(): void {
    if (this.running) void this.poll()
  }

  private startPolling(): void {
    void this.poll()
    this.timer = setInterval(() => void this.poll(), REFRESH_MS)
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private async poll(): Promise<void> {
    if (!this.machineId || this.inFlight) return
    this.inFlight = true
    try {
      const dashboard = await machinesApi.dashboard(this.machineId)
      this.handlers.onTelemetry?.(dashboard.telemetry, dashboard)
      this.handlers.onMachineStatus?.(dashboard)
    } catch {
      // surfaced by the owning screen's error state; keep polling
    } finally {
      this.inFlight = false
    }
  }
}

export const realtimeService = new RealtimeService()

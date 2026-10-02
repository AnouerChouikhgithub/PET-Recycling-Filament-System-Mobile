/** Endpoint wrappers — same routes as web-app/src/api/*. */
import { api, setToken } from './client'
import type {
  AuthPayload,
  FilamentProduction,
  Machine,
  MachineCommandResult,
  MachineCommandType,
  MachineDashboardView,
  MachineSession,
  MachineStatusView,
  MachineTelemetry,
  RecyclingRecord,
  RecyclingTotals,
  User,
} from '../data/api'

export const authApi = {
  async login(email: string, password: string): Promise<AuthPayload> {
    const data = await api.post<AuthPayload>('/auth/login', { email, password })
    await setToken(data.token)
    return data
  },

  async register(email: string, password: string, name: string): Promise<AuthPayload> {
    const data = await api.post<AuthPayload>('/auth/register', { email, password, name })
    await setToken(data.token)
    return data
  },

  async me(): Promise<User> {
    return api.get<User>('/me')
  },

  async logout(): Promise<void> {
    // Stateless JWT: discarding the token IS logout.
    await setToken(null)
  },
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const search = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export const machinesApi = {
  list(): Promise<Machine[]> {
    return api.get('/machines')
  },

  status(id: string): Promise<MachineStatusView> {
    return api.get(`/machines/${id}/status`)
  },

  dashboard(id: string): Promise<MachineDashboardView> {
    return api.get(`/machines/${id}/dashboard`)
  },

  telemetryHistory(id: string, params?: { limit?: number; offset?: number; since?: string }): Promise<MachineTelemetry[]> {
    return api.get(`/machines/${id}/telemetry${qs(params)}`)
  },

  sessions(id: string, params?: { limit?: number; offset?: number; status?: string }): Promise<MachineSession[]> {
    return api.get(`/machines/${id}/sessions${qs(params)}`)
  },

  production(id: string, params?: { limit?: number; offset?: number }): Promise<FilamentProduction[]> {
    return api.get(`/machines/${id}/production${qs(params)}`)
  },

  recycling(
    id: string,
    params?: { limit?: number; offset?: number },
  ): Promise<{ records: RecyclingRecord[]; totals: RecyclingTotals }> {
    return api.get(`/machines/${id}/recycling${qs(params)}`)
  },
}

/** Fire a guarded remote command (backend validates state + safe ranges). */
export function sendMachineCommand(
  machineId: string,
  command: MachineCommandType,
  value?: number,
): Promise<MachineCommandResult> {
  const body: Record<string, unknown> = { command }
  if (value !== undefined) body.value = value
  return api.post(`/machines/${machineId}/commands`, body)
}

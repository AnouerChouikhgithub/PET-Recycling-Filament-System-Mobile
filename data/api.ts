/**
 * 3awedlou API CONTRACT (mobile copy)
 * -----------------------------------
 * Mirrors the Symfony backend responses EXACTLY — same field names, same
 * enums, same envelope as web-app/src/types/api.ts. When the backend contract
 * changes, update BOTH copies (see backend/docs/api-contract.md).
 */

/** Every API response is wrapped in this envelope. */
export interface ApiEnvelope<T> {
  success: boolean
  data: T
  meta?: Record<string, unknown>
}

export interface ApiErrorBody {
  code: string
  message: string
  details?: Record<string, string[]>
}

/**
 * Machine lifecycle. `offline` is DERIVED by the backend from `lastSeenAt`;
 * devices never report it themselves.
 */
export type MachineStatus = 'idle' | 'heating' | 'extruding' | 'paused' | 'error' | 'offline'

export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'failed'

export type FilamentQuality = 'excellent' | 'good' | 'fair' | 'poor'

export type MachineCommandType =
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'setTargetTemperature'
  | 'setMotorSpeed'
  | 'setFan'

export interface User {
  id: string
  email: string
  name: string
  roles: string[]
  createdAt: string
}

export interface AuthPayload {
  token: string
  tokenType: 'Bearer'
  /** Returned by login/register and rotated by /auth/token/refresh. */
  refresh_token: string
  user: User
}

export interface Machine {
  id: string
  name: string
  identifier: string
  status: MachineStatus
  reportedStatus: MachineStatus
  lastSeenAt: string | null
  secondsSinceLastSeen: number | null
  createdAt: string
  updatedAt: string
  owner: string | null
}

export interface MachineTelemetry {
  id: string
  machineId: string
  temperature: number | null
  targetTemperature: number | null
  heaterState: boolean | null
  motorState: boolean | null
  motorSpeed: number | null
  fanState: boolean | null
  filamentSpeed: number | null
  filamentDiameter: number | null
  energyConsumption: number | null
  extra: Record<string, unknown> | null
  recordedAt: string
}

export interface MachineSession {
  id: string
  machineId: string
  operator: string | null
  startedAt: string
  endedAt: string | null
  status: SessionStatus
  materialInput: number | null
  materialOutput: number | null
  durationMinutes: number | null
  notes: string | null
}

export interface FilamentProduction {
  id: string
  sessionId: string
  batchCode: string
  diameterTarget: number
  diameterActual: number | null
  diameterSamples: number[] | null
  weightGrams: number | null
  lengthMeters: number | null
  durationMinutes: number | null
  material: string
  color: string
  colorHex: string
  quality: FilamentQuality
  notes: string | null
  producedAt: string
}

export interface RecyclingRecord {
  id: string
  sessionId: string
  machineId: string
  inputMaterial: string | null
  inputMassGrams: number | null
  outputMaterial: string | null
  outputMassGrams: number | null
  durationMinutes: number | null
  avgTemperature: number | null
  notes: string | null
  recycledAt: string
}

export interface RecyclingTotals {
  records: number
  inputGrams: number | null
  outputGrams: number | null
}

export interface MachineStatusView {
  machineId: string
  identifier: string
  name: string
  status: MachineStatus
  reportedStatus: MachineStatus
  lastSeenAt: string | null
  secondsSinceLastSeen: number | null
}

export interface MachineDashboardView extends Machine {
  telemetry: MachineTelemetry | null
  activeSessionId: string | null
  activeSession: MachineSession | null
  /** oldest → newest (chart order) */
  recentTelemetry: MachineTelemetry[]
  recyclingTotals: RecyclingTotals
}

export type CommandDelivery = 'published_to_broker' | 'buffered_not_sent'

export interface MachineCommandResult {
  machineId: string
  identifier: string
  command: MachineCommandType
  value: number | null
  topic: string
  accepted: boolean
  /** Audit-row correlation id; device acks reference it. */
  commandId: string
  /** Broker acceptance only — never proof of physical execution. */
  delivery: CommandDelivery
  /**
   * False on the immediate 202. True only after the backend matched a real
   * MQTT command_ack for this command id and machine to the audit row.
   */
  deviceAcknowledged: boolean
  sentAt: string
  expiresAt: string
}

export type AlertSeverity = 'info' | 'warning' | 'error' | 'success'

/** Client-side alerts — DERIVED from real machine state, never fabricated. */
export interface MachineAlert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
  date: string
  read: boolean
}

/*
 * ---------------------------------------------------------------------------
 * AI agent (read-only assistant). Verified against the committed Symfony
 * controller (src/Controller/Api/AgentController.php):
 *
 *   POST   /api/agent/chat               { conversationId?, message }
 *   DELETE /api/agent/conversations/{id} -> { deleted, conversationId }
 *   DELETE /api/agent/conversations      -> { deleted, count }
 *
 * There is NO conversation-list endpoint: the server loads the last
 * AGENT_CONTEXT_MESSAGES messages itself, so the client sends ONLY the new
 * message (never the transcript).
 *
 * Same field names as web-app/src/types/api.ts — keep both copies in sync.
 * ---------------------------------------------------------------------------
 */

/** One read-only tool the assistant used for a turn. */
export interface AgentToolCall {
  name: string
  /** Backend summary, e.g. "get_latest_telemetry: 12 row(s)". */
  summary: string
}

/** Token accounting reported in `meta.usage` (wire keys input/output). */
export interface AgentUsage {
  input: number
  output: number
}

export interface AgentAssistantMessage {
  id: string
  role: 'assistant'
  content: string
  toolCalls: AgentToolCall[]
  createdAt: string
}

export interface AgentChatResponse {
  conversationId: string
  message: AgentAssistantMessage
  usage: AgentUsage | null
}

export interface AgentConversationDeleted {
  deleted: boolean
  conversationId: string
}

export interface AgentConversationsDeleted {
  deleted: boolean
  count: number
}

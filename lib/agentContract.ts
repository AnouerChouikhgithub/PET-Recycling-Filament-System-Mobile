/**
 * AI assistant contract — PURE logic (no React, no React Native, no network).
 *
 * Everything here is derived from the committed Symfony code, not from the
 * design documents:
 *
 *   - AgentConfig::MIN_MESSAGE_CHARS = 1, AGENT_MSG_MAX_CHARS default = 4000
 *   - 422 VALIDATION_FAILED            (message length / body shape)
 *   - 429 AGENT_RATE_LIMITED           + Retry-After: <seconds>
 *   - 429 AGENT_DAILY_TOKEN_CAP        + Retry-After: seconds until 00:00 UTC
 *   - 503 AGENT_LLM_UNAVAILABLE        + Retry-After: 5
 *   - 404 AGENT_NOT_FOUND              (conversation unknown or foreign)
 *   - 404 code NOT_FOUND, message AGENT_DISABLED (flag off; the whole surface
 *     is masked, so the disabled state is 404 + that message, never a code)
 *   - 401 UNAUTHORIZED                 (security firewall: ^/api/ needs a JWT)
 *
 * Keeping this file dependency-free is deliberate: api/agent.ts does the I/O
 * and this module owns every rule, so the rules can be unit-tested without
 * Expo (see __tests__/ and npm test).
 */
import type { AgentToolCall, AgentUsage } from '../data/api'

/** Backend limits (AgentConfig). The client mirrors them to fail fast. */
export const AGENT_MIN_MESSAGE_CHARS = 1
export const AGENT_MESSAGE_MAX_CHARS = 4000

/**
 * Client-side bound on one turn. The backend's own provider budget is
 * AGENT_CONNECT_TIMEOUT_SEC (5) + AGENT_REQUEST_TIMEOUT_SEC (30) per round and
 * up to AGENT_MAX_TOOL_ROUNDS (4) rounds, so a real turn can take ~2 minutes;
 * this only exists so a hung socket cannot leave the composer stuck forever.
 */
export const AGENT_RESPONSE_TIMEOUT_MS = 120_000

/** Stable failure classes the UI switches on. */
export type AgentErrorKind =
  | 'auth'
  | 'disabled'
  | 'rate_limited'
  | 'daily_cap'
  | 'provider'
  | 'network'
  | 'validation'
  | 'conversation_missing'
  | 'malformed'
  | 'unknown'
  | 'aborted'

/** Kinds an explicit user retry may fix (never retried automatically). */
const RETRYABLE: ReadonlySet<AgentErrorKind> = new Set(['provider', 'network', 'unknown'])

/** Every failure the assistant can surface, already mapped to a safe message. */
export class AgentRequestError extends Error {
  constructor(
    public readonly kind: AgentErrorKind,
    message: string,
    /** Seconds from the Retry-After header, when the backend sent one. */
    public readonly retryAfterSeconds: number | null = null,
    public readonly status = 0,
  ) {
    super(message)
    this.name = 'AgentRequestError'
  }

  /** Transient failures may be retried by an explicit user action. */
  get retryable(): boolean {
    return RETRYABLE.has(this.kind)
  }
}

/** The parts of a transport failure this module needs (ApiError fits it). */
export interface AgentFailure {
  code?: string
  message?: string
  status?: number
  retryAfterSeconds?: number | null
  aborted?: boolean
}

/** Parses Retry-After (delta-seconds only; HTTP dates are ignored). */
export function parseRetryAfter(raw: string | null | undefined): number | null {
  if (!raw) return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null
}

/**
 * Maps a transport failure to a safe, user-facing error. Messages are fixed
 * strings (plus the backend's own envelope message for validation), so no
 * provider body, SQL text or stack trace can reach the UI.
 */
export function describeAgentFailure(failure: AgentFailure): AgentRequestError {
  if (failure.aborted) return new AgentRequestError('aborted', 'Request cancelled.')

  const retryAfter = failure.retryAfterSeconds ?? null
  const status = failure.status ?? 0

  switch (failure.code) {
    case 'UNAUTHORIZED':
      return new AgentRequestError('auth', 'Your session has expired. Please sign in again.', null, status)
    case 'AGENT_RATE_LIMITED':
      return new AgentRequestError('rate_limited', 'Too many messages. Please wait a moment.', retryAfter, status)
    case 'AGENT_DAILY_TOKEN_CAP':
      return new AgentRequestError(
        'daily_cap',
        'Daily AI usage limit reached. It resets at 00:00 UTC.',
        retryAfter,
        status,
      )
    case 'AGENT_LLM_UNAVAILABLE':
      return new AgentRequestError(
        'provider',
        'The assistant could not generate a response. Please try again.',
        retryAfter,
        status,
      )
    case 'VALIDATION_FAILED':
      return new AgentRequestError('validation', failure.message || 'That message cannot be sent.', null, status)
    case 'AGENT_NOT_FOUND':
      return new AgentRequestError('conversation_missing', 'This conversation no longer exists.', null, status)
    case 'NETWORK_ERROR':
      return new AgentRequestError('network', 'Cannot reach the 3awedlou server. Check your connection.', null, 0)
    case 'BAD_RESPONSE':
      return new AgentRequestError('malformed', 'The assistant sent an unexpected response.', null, status)
    default:
      break
  }

  // The backend masks the disabled surface as 404 + generic NOT_FOUND code,
  // with the explicit AGENT_DISABLED marker in its message. Other 404s are
  // routing/resource failures and must not be misreported as disabled.
  if (status === 404 && failure.code === 'NOT_FOUND' && failure.message?.includes('AGENT_DISABLED')) {
    return new AgentRequestError('disabled', 'The assistant is not available right now.', null, 404)
  }
  if (status === 401) {
    return new AgentRequestError('auth', 'Your session has expired. Please sign in again.', null, 401)
  }

  return new AgentRequestError('unknown', 'Something went wrong. Please try again.', null, status)
}

/** True only for the backend's explicit disabled-surface response. */
export function isAgentDisabled(error: unknown): boolean {
  return error instanceof AgentRequestError && error.kind === 'disabled'
}

/* ------------------------------------------------------------------ parsing */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

/**
 * Normalizes one tool call. Untrusted: only string name/summary survive, the
 * list is capped, and an unknown name is kept verbatim (it is a constant, never
 * a payload) — never executed, never turned into UI markup.
 */
export function parseToolCalls(value: unknown): AgentToolCall[] {
  if (!Array.isArray(value)) return []
  const calls: AgentToolCall[] = []
  for (const entry of value.slice(0, 20)) {
    const record = asRecord(entry)
    if (!record) continue
    const name = typeof record.name === 'string' ? record.name : null
    const summary = typeof record.summary === 'string' ? record.summary : null
    if (name === null || summary === null) continue
    calls.push({ name, summary })
  }
  return calls
}

/** `meta.usage` (wire keys input/output) — null when absent or unusable. */
export function parseUsage(meta: Record<string, unknown> | null | undefined): AgentUsage | null {
  const usage = asRecord(meta?.usage)
  if (!usage) return null
  const input = Number(usage.input)
  const output = Number(usage.output)
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null
  return { input: Math.max(0, Math.trunc(input)), output: Math.max(0, Math.trunc(output)) }
}

export interface ParsedChatTurn {
  conversationId: string
  content: string
  toolCalls: AgentToolCall[]
  createdAt: string
  usage: AgentUsage | null
}

/**
 * Validates the untrusted 200 payload. A missing conversation id or message
 * body is a malformed response — never silently rendered as an empty answer.
 */
export function parseChatResponse(data: unknown, meta: Record<string, unknown> | null | undefined): ParsedChatTurn {
  const payload = asRecord(data)
  const conversationId = payload?.conversationId
  const message = asRecord(payload?.message)
  const content = message?.content

  if (typeof conversationId !== 'string' || conversationId === '' || typeof content !== 'string') {
    throw new AgentRequestError('malformed', 'The assistant sent an unexpected response.', null, 200)
  }

  return {
    conversationId,
    content,
    toolCalls: parseToolCalls(message?.toolCalls),
    createdAt: typeof message?.createdAt === 'string' ? message.createdAt : '',
    usage: parseUsage(meta),
  }
}

/** Validates a delete payload; a wrong shape is a malformed response. */
export function parseDeleteResult(data: unknown): { deleted: boolean; conversationId: string | null; count: number | null } {
  const payload = asRecord(data)
  if (!payload || payload.deleted !== true) {
    throw new AgentRequestError('malformed', 'The assistant sent an unexpected response.', null, 200)
  }
  return {
    deleted: true,
    conversationId: typeof payload.conversationId === 'string' ? payload.conversationId : null,
    count: typeof payload.count === 'number' && Number.isFinite(payload.count) ? Math.trunc(payload.count) : null,
  }
}

/* ------------------------------------------------- transcript presentation */

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  /** Untrusted text. Rendered as TEXT only — never as HTML/Markdown. */
  content: string
  toolCalls: AgentToolCall[]
  createdAt: string
}

/** Human labels for the five read-only tools the backend exposes. */
export const TOOL_LABELS: Record<string, string> = {
  list_my_machines: 'Checked your machines',
  get_latest_telemetry: 'Read the latest telemetry',
  get_recent_events: 'Read recent machine events',
  explain_fault_code: 'Looked up the fault code',
  get_audit_log: 'Read the machine activity log',
}

export interface ToolCallPresentation {
  /** Known tool -> friendly label; unknown tool -> the raw name (a constant). */
  label: string
  /** Backend-provided summary verbatim (e.g. "get_latest_telemetry: 12 row(s)"). */
  detail: string
  /** True when the summary reports a failure code instead of a row count. */
  failed: boolean
}

/**
 * Presentation for one tool call. The backend summary format is
 * `"<tool>: <n> row(s)"`, `"<tool>: ok"` or `"<tool>: <CODE>"`, so anything
 * that is not a row count/ok is surfaced as a failed data read.
 */
export function describeToolCall(call: AgentToolCall): ToolCallPresentation {
  const detail = call.summary
  const separator = detail.lastIndexOf(': ')
  const outcome = separator >= 0 ? detail.slice(separator + 2).trim() : ''
  const ok = outcome === 'ok' || /^\d+\s+row\(s\)$/.test(outcome)

  return {
    label: TOOL_LABELS[call.name] ?? call.name,
    detail,
    failed: !ok,
  }
}

/** Client-side validation mirroring the backend limits (1..4000 chars). */
export function validateMessage(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed.length < AGENT_MIN_MESSAGE_CHARS) return 'Type a question first.'
  if (trimmed.length > AGENT_MESSAGE_MAX_CHARS) {
    return `Messages can be up to ${AGENT_MESSAGE_MAX_CHARS.toLocaleString('en-US')} characters.`
  }
  return null
}

let sequence = 0

/** Local transcript id. Not a server id — the backend assigns its own. */
export function nextMessageId(prefix: ChatRole): string {
  sequence += 1
  return `${prefix}-${sequence}`
}

/** Test seam so ids are deterministic per test. */
export function resetMessageIdSequence(): void {
  sequence = 0
}

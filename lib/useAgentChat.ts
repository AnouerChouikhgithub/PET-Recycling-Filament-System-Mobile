/**
 * Chat state machine for the AI assistant (non-streaming contract) — mobile.
 *
 * Rules taken from the verified backend behaviour:
 *  - the ONLY payload is the new message (+ conversationId when continuing), so
 *    the transcript here is display state and can never be re-sent;
 *  - one in-flight turn at a time: a second submit while pending is dropped
 *    (POSTs are never auto-retried — a blind retry would append the question to
 *    the server-side conversation twice and bill the user again);
 *  - a failed turn keeps the user's message on screen and shows a notice: it is
 *    never presented as a completed assistant answer;
 *  - Retry is an explicit user action and re-runs the SAME message against the
 *    conversation id used by that attempt;
 *  - a turn is bounded by AGENT_RESPONSE_TIMEOUT_MS so a hung socket cannot
 *    leave the composer stuck forever (the backend's own provider budget can
 *    legitimately take ~2 minutes, so the bound is generous).
 *
 * Deliberate difference from docs/ai-agent-ui.md §7: backgrounding the app does
 * NOT abort an in-flight turn. Aborting would discard an answer the user
 * already paid for (tokens were reserved server-side) for no benefit, because
 * React Native keeps the request alive briefly anyway. The design note is
 * updated to match this.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { agentApi, AGENT_RESPONSE_TIMEOUT_MS, type AgentErrorKind } from '../api/agent'
import { nextMessageId, validateMessage, type ChatMessage } from './agentContract'

export interface AgentNotice {
  kind: AgentErrorKind
  message: string
  /** An explicit user retry may succeed (transient provider/network). */
  retryable: boolean
}

interface LastAttempt {
  text: string
  conversationId: string | null
}

const RETRYABLE: ReadonlySet<AgentErrorKind> = new Set(['provider', 'network', 'unknown'])

export interface AgentChat {
  messages: ChatMessage[]
  conversationId: string | null
  sending: boolean
  notice: AgentNotice | null
  /** The backend's explicit AGENT_DISABLED response means the surface is switched off. */
  disabled: boolean
  /** Seconds left before the per-user rate limit window reopens (null = none). */
  rateLimitRemainingSeconds: number | null
  /** True while a rate limit is active (composer disabled). */
  rateLimited: boolean
  canRetry: boolean
  /** Token usage of the last successful turn, when the backend reported it. */
  lastUsage: { input: number; output: number } | null
  send: (text: string) => Promise<boolean>
  retry: () => Promise<boolean>
  startNewConversation: () => void
  deleteConversation: () => Promise<boolean>
  deleteAllConversations: () => Promise<boolean>
  dismissNotice: () => void
}

export function useAgentChat(): AgentChat {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<AgentNotice | null>(null)
  const [disabled, setDisabled] = useState(false)
  const [lastUsage, setLastUsage] = useState<{ input: number; output: number } | null>(null)
  const [rateLimitedUntil, setRateLimitedUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const inFlight = useRef<AbortController | null>(null)
  const lastAttempt = useRef<LastAttempt | null>(null)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // Unmount hygiene: stop the HTTP request. The backend may still finish the
      // turn server-side (accounting was reserved up front) — the answer is
      // simply not shown, because the transcript is screen state.
      inFlight.current?.abort()
    }
  }, [])

  /* Countdown ticker while a rate limit is active. */
  useEffect(() => {
    if (rateLimitedUntil === null) return
    const tick = () => {
      const time = Date.now()
      setNow(time)
      if (time >= rateLimitedUntil) setRateLimitedUntil(null)
    }
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [rateLimitedUntil])

  const rateLimitRemainingSeconds = useMemo(() => {
    if (rateLimitedUntil === null) return null
    return Math.max(0, Math.ceil((rateLimitedUntil - now) / 1000))
  }, [rateLimitedUntil, now])

  /**
   * Runs one turn. `appendUserMessage` is false for a retry so the transcript
   * never shows the same question twice for one logical turn.
   */
  const runTurn = useCallback(
    async (text: string, conversationIdForTurn: string | null, appendUserMessage: boolean): Promise<boolean> => {
      if (inFlight.current) return false

      if (appendUserMessage) {
        setMessages((current) => [
          ...current,
          { id: nextMessageId('user'), role: 'user', content: text, toolCalls: [], createdAt: new Date().toISOString() },
        ])
      }

      setNotice(null)
      setSending(true)
      lastAttempt.current = { text, conversationId: conversationIdForTurn }

      const controller = new AbortController()
      inFlight.current = controller
      let timedOut = false
      const timeout = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, AGENT_RESPONSE_TIMEOUT_MS)

      try {
        const response = await agentApi.chat(text, conversationIdForTurn, controller.signal)
        if (!mounted.current) return false

        setConversationId(response.conversationId)
        setLastUsage(response.usage)
        setMessages((current) => [
          ...current,
          {
            // Transcript rows are keyed LOCALLY: the server id is metadata and a
            // repeating/empty id must never collide in the list key space (two
            // turns of one conversation are distinct rows).
            id: nextMessageId('assistant'),
            role: 'assistant',
            content: response.content,
            toolCalls: response.toolCalls,
            createdAt: response.createdAt,
          },
        ])
        lastAttempt.current = null
        return true
      } catch (error) {
        if (!mounted.current) return false
        const agentError = error as { kind?: AgentErrorKind; message?: string; retryAfterSeconds?: number | null }
        const kind = agentError.kind ?? 'unknown'

        // A client-side timeout is reported as a retryable network problem
        // rather than silently swallowed like a plain abort.
        if (kind === 'aborted' && !timedOut) return false

        if (kind === 'rate_limited') {
          const seconds = agentError.retryAfterSeconds ?? 60
          setRateLimitedUntil(Date.now() + seconds * 1000)
          setNow(Date.now())
        }

        if (kind === 'disabled') setDisabled(true)

        // A conversation that no longer exists (soft-deleted/foreign) can only be
        // replaced by a NEW conversation on the next attempt.
        if (kind === 'conversation_missing') setConversationId(null)

        setNotice(
          timedOut
            ? {
                kind: 'network',
                message: 'The assistant took too long to answer. Please try again.',
                retryable: true,
              }
            : {
                kind,
                message: agentError.message ?? 'Something went wrong. Please try again.',
                retryable: RETRYABLE.has(kind),
              },
        )
        return false
      } finally {
        clearTimeout(timeout)
        if (inFlight.current === controller) inFlight.current = null
        if (mounted.current) setSending(false)
      }
    },
    [],
  )

  const send = useCallback(
    async (rawText: string): Promise<boolean> => {
      const text = rawText.trim()
      const validationError = validateMessage(text)
      if (validationError) {
        setNotice({ kind: 'validation', message: validationError, retryable: false })
        return false
      }
      if (rateLimitedUntil !== null && Date.now() < rateLimitedUntil) {
        setNotice({ kind: 'rate_limited', message: 'Too many messages. Please wait a moment.', retryable: false })
        return false
      }
      if (inFlight.current) return false

      return runTurn(text, conversationId, true)
    },
    [conversationId, rateLimitedUntil, runTurn],
  )

  const retry = useCallback(async (): Promise<boolean> => {
    const attempt = lastAttempt.current
    if (!attempt || inFlight.current) return false
    return runTurn(attempt.text, attempt.conversationId, false)
  }, [runTurn])

  const startNewConversation = useCallback(() => {
    // Local only: the id is dropped so the next message creates a fresh
    // server-side conversation. Existing ones are removed explicitly
    // (deleteConversation / deleteAllConversations) — there is no list API.
    setMessages([])
    setConversationId(null)
    setNotice(null)
    setLastUsage(null)
    lastAttempt.current = null
  }, [])

  const deleteConversation = useCallback(async (): Promise<boolean> => {
    const id = conversationId
    if (id === null) {
      // Nothing persisted server-side yet — clearing the screen is the truth.
      startNewConversation()
      return true
    }
    try {
      await agentApi.deleteConversation(id)
      if (mounted.current) startNewConversation()
      return true
    } catch (error) {
      if (!mounted.current) return false
      const agentError = error as { kind?: AgentErrorKind; message?: string }
      setNotice({
        kind: agentError.kind ?? 'unknown',
        message: agentError.message ?? 'The conversation could not be deleted.',
        retryable: false,
      })
      return false
    }
  }, [conversationId, startNewConversation])

  const deleteAllConversations = useCallback(async (): Promise<boolean> => {
    try {
      await agentApi.deleteAllConversations()
      if (mounted.current) startNewConversation()
      return true
    } catch (error) {
      if (!mounted.current) return false
      const agentError = error as { kind?: AgentErrorKind; message?: string }
      setNotice({
        kind: agentError.kind ?? 'unknown',
        message: agentError.message ?? 'The conversations could not be deleted.',
        retryable: false,
      })
      return false
    }
  }, [startNewConversation])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return {
    messages,
    conversationId,
    sending,
    notice,
    disabled,
    rateLimitRemainingSeconds,
    rateLimited: rateLimitRemainingSeconds !== null,
    canRetry: lastAttempt.current !== null && notice !== null,
    lastUsage,
    send,
    retry,
    startNewConversation,
    deleteConversation,
    deleteAllConversations,
    dismissNotice,
  }
}

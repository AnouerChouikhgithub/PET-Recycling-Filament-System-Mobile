/**
 * AI assistant endpoints (mobile).
 *
 * Verified against the committed Symfony controller
 * (src/Controller/Api/AgentController.php) and the exception subscriber
 * (src/Api/EventSubscriber/ApiExceptionSubscriber.php):
 *
 *   POST   /api/agent/chat               { conversationId?, message } -> 200
 *   DELETE /api/agent/conversations/{id} -> 200 { deleted, conversationId }
 *   DELETE /api/agent/conversations      -> 200 { deleted, count }
 *
 * There is NO conversation-list/history endpoint: the server loads the last
 * AGENT_CONTEXT_MESSAGES (12) messages itself, so the client sends ONLY the new
 * message and never re-sends the transcript. The on-screen transcript is
 * display state.
 *
 * Wire-level notes taken from the backend code, not from the design docs:
 *  - AGENT_ENABLED=false makes every route answer 404 with the generic code
 *    NOT_FOUND and the message AGENT_DISABLED (errorCodeFor() maps 404 ->
 *    NOT_FOUND), so the disabled state is 404 + no AGENT_NOT_FOUND code.
 *  - 429 (rate limit / daily cap) and 503 send Retry-After; the value is read
 *    from the response headers by the shared client.
 *  - nothing is auto-retried here: a blind POST retry would append the question
 *    to the server-side conversation twice and bill the user twice.
 *
 * All rules live in lib/agentContract.ts (pure, unit-tested); this module only
 * moves bytes and normalizes failures.
 */
import { ApiError, requestRaw } from './client'
import {
  AgentRequestError,
  describeAgentFailure,
  parseChatResponse,
  parseDeleteResult,
  parseRetryAfter,
  type AgentErrorKind,
  type ParsedChatTurn,
} from '../lib/agentContract'

export type { AgentErrorKind, ParsedChatTurn }
export { AgentRequestError, isAgentDisabled, AGENT_MESSAGE_MAX_CHARS, AGENT_RESPONSE_TIMEOUT_MS } from '../lib/agentContract'

/** Adapts a transport failure (ApiError / AbortError / anything) to our kinds. */
export function toAgentError(error: unknown): AgentRequestError {
  if (error instanceof AgentRequestError) return error

  if (error instanceof Error && error.name === 'AbortError') {
    return new AgentRequestError('aborted', 'Request cancelled.')
  }

  if (error instanceof ApiError) {
    return describeAgentFailure({
      code: error.code,
      message: error.message,
      status: error.status,
      retryAfterSeconds: parseRetryAfter(error.headers?.get('Retry-After')),
    })
  }

  return describeAgentFailure({})
}

export const agentApi = {
  /**
   * One turn. `conversationId` is omitted for a new conversation (the backend
   * creates one and returns its id). No retry, no streaming: the contract is a
   * single non-streaming JSON round trip.
   */
  async chat(message: string, conversationId: string | null = null, signal?: AbortSignal): Promise<ParsedChatTurn> {
    const body: Record<string, unknown> = { message }
    if (conversationId) body.conversationId = conversationId

    try {
      const result = await requestRaw<unknown>('/agent/chat', { method: 'POST', body, signal })
      return parseChatResponse(result.data, result.meta)
    } catch (error) {
      throw toAgentError(error)
    }
  },

  /** Soft-deletes one conversation (owner-scoped server-side). */
  async deleteConversation(id: string, signal?: AbortSignal): Promise<{ deleted: boolean; conversationId: string | null }> {
    try {
      const result = await requestRaw<unknown>(`/agent/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        signal,
      })
      return parseDeleteResult(result.data)
    } catch (error) {
      throw toAgentError(error)
    }
  },

  /** Soft-deletes every conversation of the signed-in user. */
  async deleteAllConversations(signal?: AbortSignal): Promise<{ deleted: boolean; count: number | null }> {
    try {
      const result = await requestRaw<unknown>('/agent/conversations', { method: 'DELETE', signal })
      return parseDeleteResult(result.data)
    } catch (error) {
      throw toAgentError(error)
    }
  },
}

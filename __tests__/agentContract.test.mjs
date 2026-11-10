/**
 * Contract tests for lib/agentContract.ts.
 *
 * Plain .mjs on purpose: this checkout has no client test framework wired
 * (`npm test` was undefined), and adding jest-expo + a React renderer for two
 * pure modules would be a large dependency change. `npm test` compiles the pure
 * modules with tsc and runs this file with Node's built-in test runner, so the
 * rules below are really executed — no framework, no mocks of the code under
 * test. (See docs/ai-agent-mobile-step-by-step.md §6.)
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import contract from '../.test-build/lib/agentContract.js'

const {
  AGENT_MESSAGE_MAX_CHARS,
  AgentRequestError,
  describeAgentFailure,
  describeToolCall,
  nextMessageId,
  parseChatResponse,
  parseDeleteResult,
  parseRetryAfter,
  parseToolCalls,
  parseUsage,
  resetMessageIdSequence,
  validateMessage,
} = contract

/* ------------------------------------------------------------ validation */

test('validateMessage accepts a normal question', () => {
  assert.equal(validateMessage('Show my machines.'), null)
})

test('validateMessage rejects an empty or whitespace-only draft', () => {
  assert.match(validateMessage(''), /Type a question first/)
  assert.match(validateMessage('   \n  '), /Type a question first/)
})

test('validateMessage accepts exactly the backend maximum', () => {
  assert.equal(validateMessage('a'.repeat(AGENT_MESSAGE_MAX_CHARS)), null)
})

test('validateMessage rejects one character over the backend maximum', () => {
  const error = validateMessage('a'.repeat(AGENT_MESSAGE_MAX_CHARS + 1))
  assert.ok(error, 'expected an error for an oversized message')
  assert.match(error, /4,000 characters/)
})

/* --------------------------------------------------------- error mapping */

test('describeAgentFailure maps the documented backend codes', () => {
  const cases = [
    ['UNAUTHORIZED', 401, 'auth'],
    ['AGENT_RATE_LIMITED', 429, 'rate_limited'],
    ['AGENT_DAILY_TOKEN_CAP', 429, 'daily_cap'],
    ['AGENT_LLM_UNAVAILABLE', 503, 'provider'],
    ['VALIDATION_FAILED', 422, 'validation'],
    ['AGENT_NOT_FOUND', 404, 'conversation_missing'],
    ['NETWORK_ERROR', 0, 'network'],
    ['BAD_RESPONSE', 200, 'malformed'],
  ]
  for (const [code, status, kind] of cases) {
    assert.equal(describeAgentFailure({ code, status }).kind, kind, `${code} -> ${kind}`)
  }
})

test('describeAgentFailure detects only the explicit disabled-surface 404', () => {
  // AGENT_ENABLED=false answers 404 with the generic NOT_FOUND code and marker.
  assert.equal(describeAgentFailure({ code: 'NOT_FOUND', message: 'AGENT_DISABLED', status: 404 }).kind, 'disabled')
  assert.equal(describeAgentFailure({ code: 'NOT_FOUND', message: 'Not found.', status: 404 }).kind, 'unknown')
  assert.equal(describeAgentFailure({ code: 'ROUTE_NOT_FOUND', message: 'Not found.', status: 404 }).kind, 'unknown')
})

test('describeAgentFailure keeps Retry-After seconds on the limit paths', () => {
  const limited = describeAgentFailure({ code: 'AGENT_RATE_LIMITED', status: 429, retryAfterSeconds: 42 })
  assert.equal(limited.retryAfterSeconds, 42)

  const cap = describeAgentFailure({ code: 'AGENT_DAILY_TOKEN_CAP', status: 429, retryAfterSeconds: 3661 })
  assert.equal(cap.retryAfterSeconds, 3661)
})

test('describeAgentFailure marks an aborted request and never retries it silently', () => {
  const aborted = describeAgentFailure({ aborted: true })
  assert.equal(aborted.kind, 'aborted')
  assert.equal(aborted.retryable, false)
})

test('only transient failures are retryable', () => {
  const retryable = ['AGENT_LLM_UNAVAILABLE', 'NETWORK_ERROR', undefined]
  for (const code of retryable) {
    assert.equal(describeAgentFailure({ code, status: 0 }).retryable, true, `${code} should be retryable`)
  }
  const fatal = ['UNAUTHORIZED', 'AGENT_RATE_LIMITED', 'AGENT_DAILY_TOKEN_CAP', 'VALIDATION_FAILED', 'AGENT_NOT_FOUND']
  for (const code of fatal) {
    assert.equal(describeAgentFailure({ code, status: 400 }).retryable, false, `${code} must not be retryable`)
  }
})

test('error messages never echo a server payload', () => {
  const leaked = describeAgentFailure({ code: 'HTTP_ERROR', message: 'SQLSTATE[42P01]: relation does not exist', status: 500 })
  assert.equal(leaked.message, 'Something went wrong. Please try again.')
  assert.doesNotMatch(leaked.message, /SQLSTATE/)
})

test('AgentRequestError is a real Error with a stable name', () => {
  const error = new AgentRequestError('network', 'nope')
  assert.ok(error instanceof Error)
  assert.equal(error.name, 'AgentRequestError')
  assert.equal(error.retryable, true)
})

/* ---------------------------------------------------------- Retry-After */

test('parseRetryAfter reads delta-seconds and rejects anything else', () => {
  assert.equal(parseRetryAfter('60'), 60)
  assert.equal(parseRetryAfter('0'), 0)
  assert.equal(parseRetryAfter('1.4'), 2)
  assert.equal(parseRetryAfter('-5'), null)
  assert.equal(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT'), null)
  assert.equal(parseRetryAfter(null), null)
  assert.equal(parseRetryAfter(undefined), null)
})

/* -------------------------------------------------------------- parsing */

test('parseToolCalls keeps only string name/summary pairs and caps the list', () => {
  assert.deepEqual(parseToolCalls(undefined), [])
  assert.deepEqual(parseToolCalls('nope'), [])
  assert.deepEqual(
    parseToolCalls([{ name: 'get_latest_telemetry', summary: 'get_latest_telemetry: 12 row(s)' }]),
    [{ name: 'get_latest_telemetry', summary: 'get_latest_telemetry: 12 row(s)' }],
  )
  assert.deepEqual(parseToolCalls([{ name: 'x' }, { summary: 'y' }, { name: 5, summary: 'z' }, null]), [])

  const many = Array.from({ length: 40 }, (_, i) => ({ name: 't', summary: `t: ${i} row(s)` }))
  assert.equal(parseToolCalls(many).length, 20)
})

test('parseUsage requires finite numbers and clamps negatives', () => {
  assert.equal(parseUsage(undefined), null)
  assert.equal(parseUsage({}), null)
  assert.equal(parseUsage({ usage: 'nope' }), null)
  assert.equal(parseUsage({ usage: { input: 'x', output: 3 } }), null)
  assert.deepEqual(parseUsage({ usage: { input: 512.7, output: -4 } }), { input: 512, output: 0 })
})

test('parseChatResponse accepts the real 200 payload', () => {
  const turn = parseChatResponse(
    {
      conversationId: '01a146d8-977e-75d4-9d0d-1dca66a29096',
      message: {
        id: '01a146d8-97d6',
        role: 'assistant',
        content: 'Your extruder is at 212.4 °C, reported 5 s ago.',
        toolCalls: [{ name: 'get_latest_telemetry', summary: 'get_latest_telemetry: 12 row(s)' }],
        createdAt: '2026-10-16T22:41:00+00:00',
      },
    },
    { usage: { input: 512, output: 96 } },
  )

  assert.equal(turn.conversationId, '01a146d8-977e-75d4-9d0d-1dca66a29096')
  assert.equal(turn.content, 'Your extruder is at 212.4 °C, reported 5 s ago.')
  assert.equal(turn.toolCalls.length, 1)
  assert.deepEqual(turn.usage, { input: 512, output: 96 })
})

test('parseChatResponse refuses a response without a conversation id or content', () => {
  assert.throws(() => parseChatResponse({ message: { content: 'hi' } }, null), (error) => error.kind === 'malformed')
  assert.throws(() => parseChatResponse({ conversationId: '', message: { content: 'hi' } }, null), (error) => error.kind === 'malformed')
  assert.throws(() => parseChatResponse({ conversationId: 'c1', message: {} }, null), (error) => error.kind === 'malformed')
  assert.throws(() => parseChatResponse(null, null), (error) => error.kind === 'malformed')
})

test('parseChatResponse tolerates a missing createdAt and malformed tool calls', () => {
  const turn = parseChatResponse({ conversationId: 'c1', message: { content: 'ok', toolCalls: 'nope' } }, null)
  assert.equal(turn.createdAt, '')
  assert.deepEqual(turn.toolCalls, [])
  assert.equal(turn.usage, null)
})

test('parseDeleteResult requires deleted=true', () => {
  assert.deepEqual(parseDeleteResult({ deleted: true, conversationId: 'c1' }), {
    deleted: true,
    conversationId: 'c1',
    count: null,
  })
  assert.deepEqual(parseDeleteResult({ deleted: true, count: 2.9 }), { deleted: true, conversationId: null, count: 2 })
  assert.throws(() => parseDeleteResult({ count: 2 }), (error) => error.kind === 'malformed')
  assert.throws(() => parseDeleteResult('nope'), (error) => error.kind === 'malformed')
})

/* ------------------------------------------------- tool-call presentation */

test('describeToolCall labels the five real tools', () => {
  const cases = [
    ['list_my_machines', 'Checked your machines'],
    ['get_latest_telemetry', 'Read the latest telemetry'],
    ['get_recent_events', 'Read recent machine events'],
    ['explain_fault_code', 'Looked up the fault code'],
    ['get_audit_log', 'Read the machine activity log'],
  ]
  for (const [name, label] of cases) {
    assert.equal(describeToolCall({ name, summary: `${name}: 1 row(s)` }).label, label)
  }
})

test('describeToolCall keeps an unknown tool name verbatim and marks failures', () => {
  const unknown = describeToolCall({ name: 'some_new_tool', summary: 'some_new_tool: TELEMETRY_READ_FAILED' })
  assert.equal(unknown.label, 'some_new_tool')
  assert.equal(unknown.failed, true)

  assert.equal(describeToolCall({ name: 'get_audit_log', summary: 'get_audit_log: 0 row(s)' }).failed, false)
  assert.equal(describeToolCall({ name: 'get_audit_log', summary: 'get_audit_log: ok' }).failed, false)
  assert.equal(describeToolCall({ name: 'get_audit_log', summary: 'unexpected' }).failed, true)
})

/* ------------------------------------------------- transcript id sequence */

test('transcript ids are locally unique and never reuse a server id', () => {
  resetMessageIdSequence()
  const first = nextMessageId('user')
  const second = nextMessageId('assistant')
  assert.equal(first, 'user-1')
  assert.equal(second, 'assistant-2')
  assert.notEqual(first, second)
})

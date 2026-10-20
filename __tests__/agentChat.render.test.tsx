/**
 * Render tests for the assistant UI (F13).
 *
 * The node --test suite covers the pure logic (contract parsing, retryability,
 * freshness); these tests mount the actual React Native components to prove the
 * accessibility contract: labelled controls, honest disabled states, an
 * explicit Retry only for transient failures, and untrusted model output
 * rendered as text.
 */
import { describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen } from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { Composer } from '../components/agent/Composer'
import { FailureNotice, ThinkingRow, noticeTitle } from '../components/agent/AgentNotices'
import { MessageBubble } from '../components/agent/MessageBubble'
import { ThemeProvider } from '../contexts/ThemeContext'
import { AGENT_MESSAGE_MAX_CHARS, type ChatMessage } from '../lib/agentContract'
import type { AgentNotice } from '../lib/useAgentChat'

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

describe('Composer', () => {
  it('keeps Send disabled for an empty draft', () => {
    renderWithTheme(
      <Composer value="" onChangeText={() => {}} onSend={() => {}} sending={false} locked={false} />,
    )
    expect(screen.getByRole('button', { name: 'Send question' }).props.accessibilityState.disabled).toBe(true)
  })

  it('enables Send for a non-empty draft and fires onSend once per press', () => {
    const onSend = jest.fn<() => void>()
    renderWithTheme(
      <Composer value="Is M-01 overheating?" onChangeText={() => {}} onSend={onSend} sending={false} locked={false} />,
    )
    const send = screen.getByRole('button', { name: 'Send question' })
    expect(send.props.accessibilityState.disabled).toBe(false)
    fireEvent.press(send)
    fireEvent.press(send)
    expect(onSend).toHaveBeenCalledTimes(2)
  })

  it('locks Send again while a turn is in flight (no double billing)', () => {
    renderWithTheme(
      <Composer value="Second question" onChangeText={() => {}} onSend={() => {}} sending locked={false} />,
    )
    expect(screen.getByRole('button', { name: 'Send question' }).props.accessibilityState.disabled).toBe(true)
  })

  it('disables the field and hides Send behind the lock when rate limited', () => {
    renderWithTheme(
      <Composer value="Hello" onChangeText={() => {}} onSend={() => {}} sending={false} locked />,
    )
    expect(screen.getByLabelText('Ask the assistant about your machine').props.editable).toBe(false)
    expect(screen.getByRole('button', { name: 'Send question' }).props.accessibilityState.disabled).toBe(true)
  })

  it('surfaces the validation error as the field hint', () => {
    renderWithTheme(
      <Composer
        value="x"
        onChangeText={() => {}}
        onSend={() => {}}
        sending={false}
        locked={false}
        error="Type a question first."
      />,
    )
    expect(screen.getByLabelText('Ask the assistant about your machine').props.accessibilityHint).toBe(
      'Type a question first.',
    )
  })

  it('disables Send when the draft is over the character limit', () => {
    renderWithTheme(
      <Composer
        value={'a'.repeat(AGENT_MESSAGE_MAX_CHARS + 1)}
        onChangeText={() => {}}
        onSend={() => {}}
        sending={false}
        locked={false}
      />,
    )
    expect(screen.getByRole('button', { name: 'Send question' }).props.accessibilityState.disabled).toBe(true)
  })
})

describe('FailureNotice', () => {
  const transient: AgentNotice = {
    kind: 'provider',
    message: 'The AI provider is temporarily unavailable.',
    retryable: true,
  }

  it('offers Retry for a transient failure and invokes onRetry', () => {
    const onRetry = jest.fn<() => void>()
    renderWithTheme(
      <FailureNotice notice={transient} canRetry onRetry={onRetry} onDismiss={() => {}} />,
    )
    fireEvent.press(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides Retry when the hook says a retry cannot succeed yet', () => {
    renderWithTheme(<FailureNotice notice={transient} canRetry={false} onRetry={() => {}} onDismiss={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('hides Retry for permanent failures', () => {
    renderWithTheme(
      <FailureNotice
        notice={{ kind: 'validation', message: 'Message too long.', retryable: false }}
        canRetry
        onRetry={() => {}}
        onDismiss={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('titles the notice per failure class and dismisses on request', () => {
    const onDismiss = jest.fn<() => void>()
    renderWithTheme(
      <FailureNotice
        notice={{ kind: 'rate_limited', message: 'You can send another question in 30s.', retryable: false }}
        canRetry
        onRetry={() => {}}
        onDismiss={onDismiss}
      />,
    )
    expect(screen.getByText('Too many messages')).toBeTruthy()
    fireEvent.press(screen.getByRole('button', { name: 'Dismiss message' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('maps every failure class to a distinct, human title', () => {
    const kinds = ['disabled', 'rate_limited', 'daily_cap', 'conversation_missing', 'validation', 'auth', 'malformed', 'provider'] as const
    const titles = kinds.map((kind) => noticeTitle(kind))
    expect(new Set(titles).size).toBe(kinds.length)
    expect(noticeTitle('disabled')).toBe('Assistant unavailable')
  })
})

describe('ThinkingRow', () => {
  it('renders the pending-turn text (announced via live region)', () => {
    renderWithTheme(<ThinkingRow />)
    expect(screen.getByText('Checking your machine data…')).toBeTruthy()
  })
})

describe('MessageBubble', () => {
  it('renders untrusted assistant output as literal text (no HTML/Markdown layer)', () => {
    const message: ChatMessage = {
      id: 'm1',
      role: 'assistant',
      content: '<script>alert(1)</script> The heater is at 210 °C.',
      toolCalls: [],
      createdAt: '2026-10-20T09:00:00Z',
    }
    renderWithTheme(<MessageBubble message={message} />)
    expect(screen.getByText('<script>alert(1)</script> The heater is at 210 °C.')).toBeTruthy()
  })

  it('renders tool calls through the labelled list', () => {
    const message: ChatMessage = {
      id: 'm2',
      role: 'assistant',
      content: 'M-01 is stable.',
      toolCalls: [
        { name: 'get_latest_telemetry', summary: 'get_latest_telemetry: 12 row(s)' },
        { name: 'explain_fault_code', summary: 'explain_fault_code: ok' },
      ],
      createdAt: '2026-10-20T09:00:00Z',
    }
    renderWithTheme(<MessageBubble message={message} />)
    expect(screen.getByText('Read the latest telemetry')).toBeTruthy()
    expect(screen.getByText('Looked up the fault code')).toBeTruthy()
  })

  it('renders the user question', () => {
    const message: ChatMessage = {
      id: 'm3',
      role: 'user',
      content: 'Is M-01 overheating?',
      toolCalls: [],
      createdAt: '2026-10-20T09:01:00Z',
    }
    renderWithTheme(<MessageBubble message={message} />)
    expect(screen.getByText('Is M-01 overheating?')).toBeTruthy()
  })
})

/**
 * Render tests for SessionCard command feedback.
 *
 * The card is mounted with a mocked machine context so the command handler can
 * be rejected / resolved deterministically. These tests cover the two honesty
 * bugs: a rejected pause must be visible (it used to be dropped with `void`),
 * and a buffered command must not be described as delivered.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { SessionCard } from '../components/SessionCard'
import { ThemeProvider } from '../contexts/ThemeContext'
import type { MachineCommandResult } from '../data/api'

jest.mock('../lib/storage', () => ({
  storage: { getString: () => new Promise<string | null>(() => {}), setString: jest.fn() },
}))

const mockPush = jest.fn<(severity: string, title: string, message?: string) => void>()

const mockMachine = {
  machine: {
    status: 'extruding',
    connected: true,
    deviceName: 'M-01',
    firmware: 'Not reported',
    currentSessionId: 's1',
    petInputG: 500,
    petProcessedG: 0,
    lastSessionId: 1,
    lastSeenLabel: 'just now',
  },
  currentSession: {
    id: 's1',
    machineId: 'm1',
    operator: 'anouer',
    startedAt: new Date().toISOString(),
    endedAt: null,
    status: 'in_progress',
    materialInput: 500,
    materialOutput: null,
    durationMinutes: null,
    notes: null,
  },
  telemetry: null,
  sensors: [{ id: 'temp', value: null }],
  pauseSession: jest.fn<() => Promise<MachineCommandResult>>(),
  resumeSession: jest.fn<() => Promise<MachineCommandResult>>(),
  stopSession: jest.fn<() => Promise<MachineCommandResult>>(),
}

jest.mock('../contexts/MachineContext', () => ({
  useMachine: () => mockMachine,
}))

// Capturing the toast call keeps the test deterministic (no 3.4 s dismiss timers).
jest.mock('../contexts/ToastContext', () => ({
  useToast: () => ({ toasts: [], push: mockPush, dismiss: jest.fn() }),
}))

function renderCard() {
  return render(
    <ThemeProvider>
      <SessionCard />
    </ThemeProvider>,
  )
}

const accepted: MachineCommandResult = {
  machineId: 'm1',
  identifier: 'M-01',
  command: 'pause',
  value: null,
  topic: 'machines/m1/commands',
  accepted: true,
  commandId: 'c1',
  delivery: 'published_to_broker',
  deviceAcknowledged: false,
  sentAt: new Date().toISOString(),
  expiresAt: new Date().toISOString(),
}

beforeEach(() => {
  mockMachine.pauseSession.mockReset()
  mockMachine.resumeSession.mockReset()
  mockMachine.stopSession.mockReset()
  mockPush.mockReset()
})

describe('SessionCard command feedback', () => {
  it('shows an error when pause is rejected', async () => {
    mockMachine.pauseSession.mockRejectedValue(new Error('Machine is not in a pausable state.'))
    renderCard()

    fireEvent.press(screen.getByText('Pause'))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith('error', 'Command rejected', 'Machine is not in a pausable state.'),
    )
  })

  it('shows an error when stop is rejected', async () => {
    mockMachine.stopSession.mockRejectedValue(new Error('Command expired.'))
    renderCard()

    fireEvent.press(screen.getByText('Stop'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('error', 'Command rejected', 'Command expired.'))
  })

  it('describes buffered delivery as not sent', async () => {
    mockMachine.pauseSession.mockResolvedValue({ ...accepted, delivery: 'buffered_not_sent', accepted: false })
    renderCard()

    fireEvent.press(screen.getByText('Pause'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const [severity, title, message] = mockPush.mock.calls[0]
    expect(severity).toBe('success')
    expect(title).toBe('Command accepted')
    expect(message).toMatch(/not sent/i)
  })

  it('defers physical outcome to telemetry after broker acceptance', async () => {
    mockMachine.pauseSession.mockResolvedValue(accepted)
    renderCard()

    fireEvent.press(screen.getByText('Pause'))

    await waitFor(() => expect(mockPush).toHaveBeenCalledTimes(1))
    const message = mockPush.mock.calls[0][2]
    expect(message).toMatch(/broker accepted/i)
    expect(message).toMatch(/telemetry/i)
  })
})

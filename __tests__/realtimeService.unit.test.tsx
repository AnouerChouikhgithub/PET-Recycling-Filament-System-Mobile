/**
 * Realtime transport + AppState tests.
 *
 * Runs under Jest because the service imports React Native's AppState. Two
 * honesty rules are covered: a configured EXPO_PUBLIC_REALTIME_URL must not
 * select a transport that does not exist, and returning to the foreground must
 * refresh immediately instead of waiting for the next 10 s tick.
 *
 * `realtimeService` is an app-lifetime singleton: it binds AppState once, so the
 * listener captured here is the one the service keeps using.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { AppState } from 'react-native'

import { machinesApi } from '../api'
import { realtimeService } from '../realtime/realtimeService'

jest.mock('../api', () => ({
  machinesApi: { dashboard: jest.fn() },
}))

const dashboard = machinesApi.dashboard as jest.MockedFunction<typeof machinesApi.dashboard>

const machine = {
  id: 'm1',
  name: 'M-01',
  identifier: 'M-01',
  status: 'idle' as const,
  reportedStatus: 'idle' as const,
  lastSeenAt: null,
  secondsSinceLastSeen: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  owner: null,
  telemetry: null,
  activeSessionId: null,
  activeSession: null,
  recentTelemetry: [],
  recyclingTotals: { records: 0, inputGrams: null, outputGrams: null },
}

type Listener = (state: 'active' | 'background' | 'inactive') => void
let listener: Listener | null = null

beforeAll(() => {
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_event: string, cb: Listener) => {
    listener = cb
    return { remove: () => {} }
  }) as unknown as typeof AppState.addEventListener)
})

beforeEach(() => {
  dashboard.mockReset()
  dashboard.mockResolvedValue(machine)
})

afterEach(() => {
  realtimeService.unsubscribe()
  delete process.env.EXPO_PUBLIC_REALTIME_URL
})

afterAll(() => {
  jest.restoreAllMocks()
})

describe('realtime transport honesty', () => {
  it('stays on polling even when a realtime URL is configured', () => {
    process.env.EXPO_PUBLIC_REALTIME_URL = 'ws://127.0.0.1:8080/ws'
    expect(realtimeService.mode).toBe('polling')
  })

  it('starts polling as soon as a machine is subscribed', async () => {
    realtimeService.subscribeToMachine('m1')
    expect(realtimeService.mode).toBe('polling')
    expect(realtimeService.isRunning).toBe(true)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dashboard).toHaveBeenCalledWith('m1')
  })

  it('refreshes immediately when the app returns to the foreground', async () => {
    realtimeService.subscribeToMachine('m1')
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dashboard).toHaveBeenCalledTimes(1)
    expect(listener).not.toBeNull()

    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => 'background' })
    listener?.('background')

    Object.defineProperty(AppState, 'currentState', { configurable: true, get: () => 'active' })
    listener?.('active')

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(dashboard).toHaveBeenCalledTimes(2)
  })
})

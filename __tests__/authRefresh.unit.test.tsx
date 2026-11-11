/**
 * API-client auth integration: one refresh for concurrent 401s, retry once,
 * logout revocation. expo-secure-store and fetch are mocked; no device.
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { Mock } from 'jest-mock'

const mockStore = new Map<string, string>()

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockStore.set(key, value)
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockStore.delete(key)
  }),
}))

import { ApiError, clearSession, request, setTokens, setUnauthorizedHandler } from '../api/client'
import { authApi } from '../api'

const ACCESS = '3awedlou.auth.token'
const REFRESH = '3awedlou.auth.refresh'

type FetchCall = { url: string; auth: string | null; body: string | null }

function jsonResponse(status: number, body: unknown): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
    headers: { get: () => null },
  } as unknown as Response
}

const ok = (data: unknown) => jsonResponse(200, { success: true, data })
const unauthorized = () =>
  jsonResponse(401, { success: false, error: { code: 'UNAUTHORIZED', message: 'expired' } })

let calls: FetchCall[]
let fetchMock: Mock<typeof fetch>
let unauthorizedHandler: Mock<() => void>

beforeEach(async () => {
  mockStore.clear()
  calls = []
  unauthorizedHandler = jest.fn()
  setUnauthorizedHandler(unauthorizedHandler)
  fetchMock = jest.fn<typeof fetch>()
  globalThis.fetch = fetchMock
  await clearSession()
})

afterEach(() => {
  setUnauthorizedHandler(null)
})

function install(handler: (call: FetchCall) => Response | Promise<Response>): void {
  fetchMock.mockImplementation(async (input: unknown, init?: RequestInit) => {
    const call: FetchCall = {
      url: String(input),
      auth: (init?.headers as Record<string, string> | undefined)?.Authorization ?? null,
      body: typeof init?.body === 'string' ? init.body : null,
    }
    calls.push(call)
    return handler(call)
  })
}

describe('mobile refresh flow', () => {
  it('performs ONE refresh for concurrent 401s and retries both requests', async () => {
    await setTokens({ token: 'old', refresh_token: 'r1' })

    let oldCalls = 0
    let release: () => void = () => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })

    install(async (call) => {
      if (call.url.endsWith('/auth/token/refresh')) {
        return ok({ token: 'new', refresh_token: 'r2', user: {} })
      }
      if (call.auth === 'Bearer old') {
        oldCalls += 1
        if (oldCalls === 2) release()
        await gate
        return unauthorized()
      }
      if (call.auth === 'Bearer new') return ok(['m1'])
      throw new Error(`unexpected Authorization: ${call.auth}`)
    })

    const [a, b] = await Promise.all([request<string[]>('/machines'), request<string[]>('/machines')])

    expect(a).toEqual(['m1'])
    expect(b).toEqual(['m1'])
    expect(calls.filter((c) => c.url.endsWith('/auth/token/refresh'))).toHaveLength(1)
    expect(mockStore.get(ACCESS)).toBe('new')
    expect(mockStore.get(REFRESH)).toBe('r2')
    expect(unauthorizedHandler).not.toHaveBeenCalled()
  })

  it('retries the original request once with the rotated access token', async () => {
    await setTokens({ token: 'old', refresh_token: 'r1' })
    install((call) => {
      if (call.url.endsWith('/auth/token/refresh')) {
        return ok({ token: 'new', refresh_token: 'r2', user: {} })
      }
      if (call.auth === 'Bearer old') return unauthorized()
      return ok({ id: 'u1' })
    })

    await expect(request('/me')).resolves.toEqual({ id: 'u1' })
    expect(calls.map((c) => c.auth)).toEqual(['Bearer old', null, 'Bearer new'])
  })

  it('logs out locally when the refresh fails', async () => {
    await setTokens({ token: 'old', refresh_token: 'r1' })
    install((call) => {
      if (call.url.endsWith('/auth/token/refresh')) return jsonResponse(401, { success: false })
      return unauthorized()
    })

    await expect(request('/me')).rejects.toBeInstanceOf(ApiError)
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1)
    expect(mockStore.has(ACCESS)).toBe(false)
    expect(mockStore.has(REFRESH)).toBe(false)
  })

  it('does not attempt a refresh for a login 401 (bad credentials)', async () => {
    install(() => unauthorized())

    await expect(authApi.login('a@b.c', 'wrong')).rejects.toBeInstanceOf(ApiError)
    expect(calls).toHaveLength(1)
    expect(unauthorizedHandler).toHaveBeenCalledTimes(1)
  })

  it('logout revokes the refresh token with the access token, then clears both', async () => {
    await setTokens({ token: 'access', refresh_token: 'r1' })
    install(() => jsonResponse(200, { success: true, data: { revoked: true } }))

    await authApi.logout()

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://127.0.0.1:8000/api/auth/logout')
    expect(calls[0].auth).toBe('Bearer access')
    expect(JSON.parse(calls[0].body ?? '{}')).toEqual({ refresh_token: 'r1' })
    expect(mockStore.has(ACCESS)).toBe(false)
    expect(mockStore.has(REFRESH)).toBe(false)
  })

  it('logout still clears locally when the revocation request fails', async () => {
    await setTokens({ token: 'access', refresh_token: 'r1' })
    fetchMock.mockImplementation(() => Promise.reject(new Error('offline')))

    await authApi.logout()

    expect(mockStore.has(ACCESS)).toBe(false)
    expect(mockStore.has(REFRESH)).toBe(false)
  })
})

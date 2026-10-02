/**
 * Central API client for the 3awedlou Symfony backend (mobile).
 *
 * Same contract as web-app/src/api/client.ts:
 *  - base URL from EXPO_PUBLIC_API_BASE_URL (LAN IP for physical devices)
 *  - Bearer token injection (single place)
 *  - envelope unwrapping + ApiError normalization
 *  - 401 handling: clear session once, notify the app (AuthContext listens)
 *
 * The JWT lives in expo-secure-store (hardware-backed) — never AsyncStorage.
 */
import * as SecureStore from 'expo-secure-store'

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export const AUTH_ERROR_EVENT = '3awedlou/auth-error'

const BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000/api').replace(/\/+$/, '')

const TOKEN_KEY = '3awedlou.auth.token'

let onUnauthorized: (() => void) | null = null

/** Called once by AuthContext so the client can flush the session on 401s. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

export function getBaseUrl(): string {
  return BASE_URL
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch {
    return null
  }
}

export async function setToken(token: string | null): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token)
    else await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch {
    /* secure store unavailable — session stays in memory only */
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

/** Single entry point for every API call. Returns unwrapped `data`. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = await getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new ApiError('NETWORK_ERROR', 'Cannot reach the 3awedlou server. Check your connection and that the API URL in .env points to your backend (LAN IP on physical devices).', 0)
  }

  if (res.status === 401) {
    await setToken(null)
    onUnauthorized?.()
    throw new ApiError('UNAUTHORIZED', 'Your session has expired. Please sign in again.', 401)
  }

  let payload: unknown
  try {
    payload = await res.json()
  } catch {
    throw new ApiError('BAD_RESPONSE', 'The server returned an unexpected response.', res.status)
  }

  const envelope = payload as { success?: boolean; data?: T; error?: { code: string; message: string; details?: Record<string, string[]> } }

  if (!res.ok || envelope.success === false) {
    const error = envelope?.error
    throw new ApiError(
      error?.code ?? 'HTTP_ERROR',
      error?.message ?? `Request failed (HTTP ${res.status}).`,
      res.status,
      error?.details,
    )
  }

  return (envelope.data ?? (payload as T)) as T
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown, signal?: AbortSignal) => request<T>(path, { method: 'POST', body, signal }),
}

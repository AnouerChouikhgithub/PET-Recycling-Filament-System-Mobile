/**
 * Single-flight refresh-token rotation.
 *
 * Kept free of expo/React Native imports so the behaviour can be tested with
 * node --test. The client injects SecureStore reads/writes and the HTTP
 * transport; this module owns only the concurrency + persistence rules:
 *
 *  - concurrent callers share ONE in-flight refresh (refresh tokens are
 *    single-use, so a second request would invalidate the first),
 *  - the rotated access + refresh pair is persisted BEFORE the caller retries,
 *  - any failure clears the local session instead of leaving a dead pair.
 */

export interface TokenPair {
  token: string
  refresh_token: string
}

export interface RefreshStore {
  getRefreshToken(): Promise<string | null>
  saveTokens(tokens: TokenPair): Promise<void>
  clearSession(): Promise<void>
}

export interface RefreshTransport {
  /** Resolves null for any non-success response; may throw for network errors. */
  refresh(refreshToken: string): Promise<TokenPair | null>
}

export class SessionRefresher {
  private inFlight: Promise<string | null> | null = null

  constructor(
    private readonly store: RefreshStore,
    private readonly transport: RefreshTransport,
  ) {}

  /**
   * Returns the new access token, or null after clearing the session.
   * Concurrent calls always receive the same promise.
   */
  refresh(): Promise<string | null> {
    if (this.inFlight) return this.inFlight

    this.inFlight = this.run().finally(() => {
      this.inFlight = null
    })
    return this.inFlight
  }

  private async run(): Promise<string | null> {
    const refreshToken = await this.store.getRefreshToken()
    if (!refreshToken) {
      await this.store.clearSession()
      return null
    }

    try {
      const rotated = await this.transport.refresh(refreshToken)
      if (!rotated || rotated.token === '' || rotated.refresh_token === '') {
        await this.store.clearSession()
        return null
      }

      // Persist the rotated pair atomically-enough: both are written before
      // the caller is allowed to retry, so a crash cannot replay the old token.
      await this.store.saveTokens(rotated)
      return rotated.token
    } catch {
      await this.store.clearSession()
      return null
    }
  }
}

export function createSessionRefresher(store: RefreshStore, transport: RefreshTransport): SessionRefresher {
  return new SessionRefresher(store, transport)
}

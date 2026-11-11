/**
 * Tests for lib/sessionRefresh.ts — the single-flight rotation controller.
 * Refresh tokens are single-use: two concurrent refreshes would invalidate
 * each other, so every concurrent caller MUST share one rotation.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import refreshModule from '../.test-build/lib/sessionRefresh.js'

const { SessionRefresher } = refreshModule

function fakeStore({ access = 'old-access', refresh = 'old-refresh' } = {}) {
  const state = { access, refresh, saves: [], clears: 0 }
  return {
    state,
    getRefreshToken: async () => state.refresh,
    saveTokens: async (tokens) => {
      state.saves.push(tokens)
      state.access = tokens.token
      state.refresh = tokens.refresh_token
    },
    clearSession: async () => {
      state.clears += 1
      state.access = null
      state.refresh = null
    },
  }
}

test('concurrent refresh calls share exactly one rotation', async () => {
  const store = fakeStore()
  let calls = 0
  let release
  const pending = new Promise((resolve) => {
    release = resolve
  })
  const transport = {
    refresh: () => {
      calls += 1
      return pending
    },
  }
  const refresher = new SessionRefresher(store, transport)

  const first = refresher.refresh()
  const second = refresher.refresh()
  assert.equal(first, second, 'both callers must await the same promise')

  release({ token: 'new-access', refresh_token: 'new-refresh' })
  assert.equal(await first, 'new-access')
  assert.equal(await second, 'new-access')
  assert.equal(calls, 1)
})

test('the rotated pair is persisted before the access token is returned', async () => {
  const store = fakeStore()
  const refresher = new SessionRefresher(store, {
    refresh: async () => ({ token: 'new-access', refresh_token: 'new-refresh' }),
  })

  assert.equal(await refresher.refresh(), 'new-access')
  assert.deepEqual(store.state.saves, [{ token: 'new-access', refresh_token: 'new-refresh' }])
  assert.equal(store.state.refresh, 'new-refresh')
  assert.equal(store.state.clears, 0)
})

test('a rejected or malformed refresh clears the local session', async () => {
  const rejected = fakeStore()
  const rejects = new SessionRefresher(rejected, {
    refresh: async () => {
      throw new Error('network down')
    },
  })
  assert.equal(await rejects.refresh(), null)
  assert.equal(rejected.state.clears, 1)
  assert.equal(rejected.state.access, null)
  assert.equal(rejected.state.refresh, null)

  const malformed = fakeStore()
  const empty = new SessionRefresher(malformed, {
    refresh: async () => ({ token: '', refresh_token: 'x' }),
  })
  assert.equal(await empty.refresh(), null)
  assert.equal(malformed.state.clears, 1)
})

test('no stored refresh token never calls the network and clears the session', async () => {
  const store = fakeStore({ access: null, refresh: null })
  let calls = 0
  const refresher = new SessionRefresher(store, {
    refresh: async () => {
      calls += 1
      return { token: 'x', refresh_token: 'y' }
    },
  })

  assert.equal(await refresher.refresh(), null)
  assert.equal(calls, 0)
  assert.equal(store.state.clears, 1)
})

/**
 * Tests for lib/alerts.ts — read-state bookkeeping for derived alerts.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import alerts from '../.test-build/lib/alerts.js'

const { markAllAsRead, countUnread } = alerts

const twoUnread = [{ id: 'a1' }, { id: 'a2' }]

test('mark all read with two unread alerts clears both badges', () => {
  const read = markAllAsRead([], ['a1', 'a2'])
  assert.deepEqual(read, ['a1', 'a2'])
  assert.equal(countUnread(twoUnread, read), 0)
})

test('mark all read keeps previously read ids and does not duplicate', () => {
  assert.deepEqual(markAllAsRead(['old', 'a1'], ['a1', 'a1', 'a2']), ['old', 'a1', 'a2'])
})

test('mark all read with no visible alerts changes nothing', () => {
  assert.deepEqual(markAllAsRead(['a1'], []), ['a1'])
  assert.equal(countUnread([], []), 0)
})

test('unread count ignores ids that are not currently visible', () => {
  assert.equal(countUnread(twoUnread, ['gone']), 2)
  assert.equal(countUnread(twoUnread, ['a1']), 1)
})

/**
 * Tests for lib/commandDelivery.ts.
 *
 * The backend can accept a command at the broker, or buffer it without sending
 * it. Neither proves the machine moved; the copy must say exactly that.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import delivery from '../.test-build/lib/commandDelivery.js'

const { commandDeliveryMessage } = delivery

test('a buffered command is described as not sent', () => {
  const message = commandDeliveryMessage({ delivery: 'buffered_not_sent', deviceAcknowledged: false })
  assert.match(message, /not sent/i)
  assert.doesNotMatch(message, /machine (is|will)/i)
})

test('broker acceptance is not presented as physical execution', () => {
  const message = commandDeliveryMessage({ delivery: 'published_to_broker', deviceAcknowledged: false })
  assert.match(message, /broker accepted/i)
  assert.match(message, /telemetry/i)
})

test('a device acknowledgement still defers to fresh telemetry', () => {
  const message = commandDeliveryMessage({ delivery: 'published_to_broker', deviceAcknowledged: true })
  assert.match(message, /acknowledged/i)
  assert.match(message, /telemetry/i)
})

test('no delivery message claims a physical outcome', () => {
  const messages = [
    commandDeliveryMessage({ delivery: 'buffered_not_sent', deviceAcknowledged: false }),
    commandDeliveryMessage({ delivery: 'published_to_broker', deviceAcknowledged: false }),
    commandDeliveryMessage({ delivery: 'published_to_broker', deviceAcknowledged: true }),
  ]
  for (const message of messages) {
    assert.doesNotMatch(message, /wound|heater (is|down)|ramp|spool(ed)?/i)
  }
})

/**
 * Tests for lib/telemetryFreshness.ts — the rules that decide whether the
 * assistant's data is fresh, stale or missing. They mirror the backend
 * (GetLatestTelemetryTool): "Not reported" is the literal for a missing
 * channel, > 120 s is stale, > 600 s is very stale.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import freshness from '../.test-build/lib/telemetryFreshness.js'

const {
  NOT_REPORTED,
  describeTelemetryFreshness,
  formatAgeSeconds,
  formatChannelValue,
  freshnessLabelText,
} = freshness

const ISO = '2026-10-16T22:00:00.000Z'
const at = (secondsAgo) => new Date(new Date(ISO).getTime() + secondsAgo * 1000).getTime()

test('a sample inside 120 s is fresh', () => {
  assert.deepEqual(describeTelemetryFreshness(ISO, at(0)), { ageSeconds: 0, label: 'fresh' })
  assert.deepEqual(describeTelemetryFreshness(ISO, at(119)), { ageSeconds: 119, label: 'fresh' })
  // Boundary: exactly 120 s is still fresh (the backend uses `> 120`).
  assert.deepEqual(describeTelemetryFreshness(ISO, at(120)), { ageSeconds: 120, label: 'fresh' })
  assert.deepEqual(describeTelemetryFreshness(ISO, at(121)), { ageSeconds: 121, label: 'stale' })
})

test('the very-stale boundary matches the backend (> 600 s)', () => {
  assert.equal(describeTelemetryFreshness(ISO, at(600)).label, 'stale')
  assert.equal(describeTelemetryFreshness(ISO, at(601)).label, 'very_stale')
  assert.equal(describeTelemetryFreshness(ISO, at(86_400)).label, 'very_stale')
})

test('a missing or invalid timestamp is unknown — never assumed fresh', () => {
  for (const value of [null, undefined, '', 'not-a-date']) {
    assert.deepEqual(describeTelemetryFreshness(value, at(0)), { ageSeconds: null, label: 'unknown' })
  }
})

test('a clock skew in the future never produces a negative age', () => {
  assert.deepEqual(describeTelemetryFreshness(ISO, at(-30)), { ageSeconds: 0, label: 'fresh' })
})

test('freshnessLabelText labels every state', () => {
  assert.equal(freshnessLabelText('fresh'), 'fresh')
  assert.equal(freshnessLabelText('stale'), 'stale')
  assert.equal(freshnessLabelText('very_stale'), 'very stale')
  assert.equal(freshnessLabelText('unknown'), 'age unknown')
})

test('a missing channel is the documented literal, never 0', () => {
  assert.equal(NOT_REPORTED, 'Not reported')
  for (const value of [null, undefined, NaN]) {
    assert.equal(formatChannelValue(value), NOT_REPORTED)
  }
})

test('a reported channel keeps its unit and precision', () => {
  assert.equal(formatChannelValue(212.44, '°C'), '212.4 °C')
  assert.equal(formatChannelValue(0, 'RPM', 0), '0 RPM')
  assert.equal(formatChannelValue(1.005, '', 2), '1.00')
})

test('formatAgeSeconds renders short ages', () => {
  assert.equal(formatAgeSeconds(null), 'unknown')
  assert.equal(formatAgeSeconds(0), '0s')
  assert.equal(formatAgeSeconds(42), '42s')
  assert.equal(formatAgeSeconds(180), '3m')
  assert.equal(formatAgeSeconds(7_200), '2h')
  assert.equal(formatAgeSeconds(259_200), '3d')
})

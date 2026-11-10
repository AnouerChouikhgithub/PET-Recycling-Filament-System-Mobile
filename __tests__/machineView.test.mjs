/**
 * Tests for lib/machineView.ts — the sensor/subsystem view models.
 *
 * The rule under test: a channel that was not reported, or whose sample is
 * stale, must stay null / "unknown". It is never rendered as a measured zero or
 * an inferred "off", and session status never proves physical spooler motion.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import view from '../.test-build/lib/machineView.js'

const { buildSensors, buildSubsystems } = view

const NOW = new Date('2026-11-10T12:00:00.000Z').getTime()
const ago = (seconds) => new Date(NOW - seconds * 1000).toISOString()

function telemetry(overrides = {}) {
  return {
    id: 't1',
    machineId: 'm1',
    temperature: null,
    targetTemperature: null,
    heaterState: null,
    motorState: null,
    motorSpeed: null,
    fanState: null,
    filamentSpeed: null,
    filamentDiameter: null,
    energyConsumption: null,
    extra: null,
    recordedAt: ago(5),
    ...overrides,
  }
}

function dashboard({ telemetry: sample = telemetry(), recentTelemetry = [], status = 'idle', activeSession = null } = {}) {
  return {
    id: 'm1',
    name: 'M-01',
    identifier: 'M-01',
    status,
    reportedStatus: status,
    lastSeenAt: ago(5),
    secondsSinceLastSeen: 5,
    createdAt: ago(86_400),
    updatedAt: ago(5),
    owner: 'u1',
    telemetry: sample,
    activeSessionId: activeSession ? activeSession.id : null,
    activeSession,
    recentTelemetry,
    recyclingTotals: { records: 0, inputGrams: null, outputGrams: null },
  }
}

const sensor = (readings, id) => readings.find((reading) => reading.id === id)

test('an absent channel stays null — never a measured zero', () => {
  const readings = buildSensors(dashboard(), NOW)
  for (const reading of readings) {
    assert.equal(reading.value, null, `${reading.id} value must stay null`)
  }
  assert.equal(sensor(readings, 'temp').target, null)
  assert.equal(sensor(readings, 'motor').target, null)
  assert.equal(sensor(readings, 'fan').target, null)
})

test('the temperature target is the reported target, with no 195 °C fallback', () => {
  const readings = buildSensors(dashboard({ telemetry: telemetry({ temperature: 210 }) }), NOW)
  assert.equal(sensor(readings, 'temp').value, 210)
  assert.equal(sensor(readings, 'temp').target, null)
  assert.equal(sensor(readings, 'temp').status, 'nominal')
})

test('temperature status is derived from the reported target', () => {
  const nominal = buildSensors(dashboard({ telemetry: telemetry({ temperature: 200, targetTemperature: 200 }) }), NOW)
  assert.equal(sensor(nominal, 'temp').status, 'nominal')

  const warning = buildSensors(dashboard({ telemetry: telemetry({ temperature: 180, targetTemperature: 200 }) }), NOW)
  assert.equal(sensor(warning, 'temp').status, 'warning')

  const error = buildSensors(dashboard({ telemetry: telemetry({ temperature: 150, targetTemperature: 200 }) }), NOW)
  assert.equal(sensor(error, 'temp').status, 'error')
})

test('an explicit zero or false is a real reading, not missing data', () => {
  const readings = buildSensors(
    dashboard({
      telemetry: telemetry({ temperature: 0, targetTemperature: 0, motorSpeed: 0, fanState: false, filamentSpeed: 0 }),
    }),
    NOW,
  )
  assert.equal(sensor(readings, 'temp').value, 0)
  assert.equal(sensor(readings, 'motor').value, 0)
  assert.equal(sensor(readings, 'feed').value, 0)
  assert.equal(sensor(readings, 'fan').value, 0, 'an explicit fanState=false is reported as 0%')
})

test('a stale sample is treated as absent', () => {
  const readings = buildSensors(
    dashboard({
      status: 'extruding',
      telemetry: telemetry({ temperature: 210, motorSpeed: 40, fanState: true, filamentSpeed: 2, recordedAt: ago(121) }),
    }),
    NOW,
  )
  for (const reading of readings) {
    assert.equal(reading.value, null, `${reading.id} must not show a stale value`)
  }
})

test('history keeps only fresh, reported numeric samples', () => {
  const readings = buildSensors(
    dashboard({
      telemetry: telemetry({ temperature: 210 }),
      recentTelemetry: [
        telemetry({ recordedAt: ago(20), temperature: 205 }),
        telemetry({ recordedAt: ago(15), temperature: null }),
        telemetry({ recordedAt: ago(400), temperature: 199 }),
        telemetry({ recordedAt: ago(10), temperature: 209 }),
      ],
    }),
    NOW,
  )
  assert.deepEqual(sensor(readings, 'temp').history, [205, 209])
})

test('subsystems report unknown when a channel is absent', () => {
  const states = buildSubsystems(dashboard(), NOW)
  for (const subsystem of states) {
    assert.equal(subsystem.state, 'unknown', `${subsystem.key} must be unknown`)
  }
})

test('subsystems map an explicit fresh false to off and true to on', () => {
  const states = buildSubsystems(
    dashboard({
      status: 'extruding',
      telemetry: telemetry({ heaterState: true, motorState: false, fanState: true, targetTemperature: 200, motorSpeed: 42 }),
    }),
    NOW,
  )
  const byKey = Object.fromEntries(states.map((state) => [state.key, state]))
  assert.equal(byKey.heater.state, 'on')
  assert.equal(byKey.motor.state, 'off')
  assert.equal(byKey.cooling.state, 'on')
})

test('subsystems are unknown when the machine is offline or the sample is stale', () => {
  const offline = buildSubsystems(
    dashboard({ status: 'offline', telemetry: telemetry({ heaterState: true, motorState: true, fanState: true }) }),
    NOW,
  )
  assert.ok(offline.filter((state) => state.key !== 'spooler').every((state) => state.state === 'unknown'))

  const stale = buildSubsystems(
    dashboard({ telemetry: telemetry({ heaterState: true, motorState: true, fanState: true, recordedAt: ago(600) }) }),
    NOW,
  )
  assert.ok(stale.filter((state) => state.key !== 'spooler').every((state) => state.state === 'unknown'))
})

test('the spooler is never claimed on from session status alone', () => {
  const activeSession = {
    id: 's1',
    machineId: 'm1',
    operator: 'anouer',
    startedAt: ago(600),
    endedAt: null,
    status: 'in_progress',
    materialInput: 500,
    materialOutput: null,
    durationMinutes: null,
    notes: null,
  }
  const states = buildSubsystems(dashboard({ status: 'extruding', activeSession }), NOW)
  const spooler = states.find((state) => state.key === 'spooler')
  assert.equal(spooler.state, 'unknown')
  assert.match(spooler.detail, /Session/)
})

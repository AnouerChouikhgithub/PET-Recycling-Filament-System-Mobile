import type { MachineDashboardView, MachineTelemetry } from '../data/api'
import { describeTelemetryFreshness } from './telemetryFreshness'

export interface SensorReading {
  id: 'temp' | 'motor' | 'fan' | 'feed'
  label: string
  shortLabel: string
  unit: string
  /** null means absent or stale, never a fabricated zero. */
  value: number | null
  target: number | null
  status: 'nominal' | 'warning' | 'error'
  history: number[]
  min: number
  max: number
  decimals?: number
}

export interface Subsystem {
  key: 'heater' | 'motor' | 'cooling' | 'spooler'
  label: string
  detail: string
  /** unknown means absent or stale; only an explicit fresh false is off. */
  state: 'on' | 'off' | 'fault' | 'unknown'
}

const deviation = (value: number, ref: number) => Math.abs(value - ref) / Math.max(1, Math.abs(ref))

export function buildSensors(view: MachineDashboardView, now = Date.now()): SensorReading[] {
  const sample = view.telemetry
  const freshSample = sample !== null
    && describeTelemetryFreshness(sample.recordedAt, now).label === 'fresh'
    ? sample
    : null
  const value = <T,>(pick: (telemetry: MachineTelemetry) => T | null): T | null =>
    freshSample ? pick(freshSample) : null
  const fanState = value((telemetry) => telemetry.fanState)
  const historyOf = (pick: (telemetry: MachineTelemetry) => number | null): number[] =>
    view.recentTelemetry
      .filter((telemetry) => describeTelemetryFreshness(telemetry.recordedAt, now).label === 'fresh')
      .map(pick)
      .filter((entry): entry is number => entry !== null)
      .slice(-24)

  const temperature = value((telemetry) => telemetry.temperature)
  const temperatureTarget = value((telemetry) => telemetry.targetTemperature)
  const tempStatus: SensorReading['status'] =
    temperature == null || temperatureTarget == null
      ? 'nominal'
      : deviation(temperature, temperatureTarget) > 0.18
        ? 'error'
        : deviation(temperature, temperatureTarget) > 0.09
          ? 'warning'
          : 'nominal'

  return [
    {
      id: 'temp',
      label: 'Extruder Temp',
      shortLabel: 'Extruder',
      unit: '°C',
      value: temperature,
      target: temperatureTarget,
      status: tempStatus,
      history: historyOf((telemetry) => telemetry.temperature),
      min: 0,
      max: 300,
    },
    {
      id: 'motor',
      label: 'Motor Speed',
      shortLabel: 'Motor',
      unit: 'unit unverified',
      value: value((telemetry) => telemetry.motorSpeed),
      target: null,
      status: 'nominal',
      history: historyOf((telemetry) => telemetry.motorSpeed),
      min: 0,
      max: 100,
    },
    {
      id: 'fan',
      label: 'Cooling Fan',
      shortLabel: 'Cooling',
      unit: '%',
      value: fanState == null ? null : fanState ? 100 : 0,
      target: null,
      status: 'nominal',
      history: historyOf((telemetry) => telemetry.fanState == null ? null : telemetry.fanState ? 100 : 0),
      min: 0,
      max: 100,
    },
    {
      id: 'feed',
      label: 'Feed Rate',
      shortLabel: 'Feed',
      unit: 'mm/s',
      value: value((telemetry) => telemetry.filamentSpeed),
      target: null,
      status: 'nominal',
      history: historyOf((telemetry) => telemetry.filamentSpeed),
      min: 0,
      max: 6,
      decimals: 1,
    },
  ]
}

export function buildSubsystems(view: MachineDashboardView, now = Date.now()): Subsystem[] {
  const sample = view.telemetry
  const freshSample = view.status !== 'offline'
    && sample !== null
    && describeTelemetryFreshness(sample.recordedAt, now).label === 'fresh'
    ? sample
    : null
  const stateFor = (reported: boolean | null | undefined): Subsystem['state'] =>
    freshSample === null || reported == null ? 'unknown' : reported ? 'on' : 'off'
  const t = freshSample

  return [
    {
      key: 'heater',
      label: 'Heater',
      detail: t?.targetTemperature != null ? `Target ${Math.round(t.targetTemperature)}°C` : 'Not reported',
      state: stateFor(t?.heaterState),
    },
    {
      key: 'motor',
      label: 'Extruder Motor',
      detail: t?.motorSpeed != null ? `${Math.round(t.motorSpeed)} (unit unverified)` : 'Not reported',
      state: stateFor(t?.motorState),
    },
    {
      key: 'cooling',
      label: 'Cooling',
      detail: t?.fanState == null ? 'Not reported' : `Fan ${t.fanState ? 'on' : 'off'}`,
      state: stateFor(t?.fanState),
    },
    {
      key: 'spooler',
      label: 'Spooler',
      detail: view.activeSession ? 'Session marked in progress' : 'No active session',
      // Session status does not prove physical spooler motion.
      state: 'unknown',
    },
  ]
}

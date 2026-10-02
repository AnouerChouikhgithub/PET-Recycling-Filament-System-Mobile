import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { timeAgo } from '../lib/format'
import { radius, spacing } from '../theme/tokens'
import { Sparkline } from '../components/charts'
import {
  AppButton,
  Badge,
  ButtonContent,
  Card,
  CardHead,
  Sheet,
  StateBlock,
} from '../components/ui'
import {
  ActivityIcon,
  CheckCircleIcon,
  CpuIcon,
  FanIcon,
  PauseIcon,
  PlayIcon,
  SpoolerIcon,
  ThermometerIcon,
  WarningIcon,
} from '../components/icons'

export function MachinePage() {
  const { theme } = useTheme()
  const { machine, sensors, subsystems, telemetry, currentSession, realtimeMode, loading, error, refresh, pauseSession, resumeSession, stopSession, sendCommand } = useMachine()
  const toast = useToast()
  const insets = useSafeAreaInsets()

  const [confirmStop, setConfirmStop] = useState(false)
  const [busy, setBusy] = useState(false)

  const disconnected = !machine.connected

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true)
    try {
      await action()
      if (done) toast.push('success', done, 'Command accepted by the backend.')
    } catch (err) {
      toast.push('error', 'Command rejected', (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (error && sensors.length === 0) {
    return (
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <Card>
          <StateBlock
            kind="offline"
            title="Backend unreachable"
            text={error}
            action="Retry"
            onAction={refresh}
          />
        </Card>
      </ScrollView>
    )
  }

  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: insets.bottom + spacing.xxl,
        gap: spacing.lg,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Connection banner (replaces the old demo banner) */}
      <View
        style={{
          flexDirection: 'row',
          gap: 10,
          backgroundColor: disconnected ? theme.dangerBg : theme.accentSoft,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: disconnected ? theme.border : theme.accentBorder,
          borderRadius: radius.md,
          padding: spacing.md,
        }}
      >
        {disconnected ? <WarningIcon size={17} color={theme.danger} /> : <ActivityIcon size={17} color={theme.accentStrong} />}
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: theme.text }}>
          {disconnected ? (
            <Text>
              <Text style={{ fontWeight: '800' }}>Machine offline. </Text>
              Commands are disabled until it reports again via the backend.
            </Text>
          ) : (
            <Text>
              <Text style={{ fontWeight: '800' }}>Connected via 3awedlou backend. </Text>
              {realtimeMode === 'polling' ? 'Data refreshes every 10 s.' : 'Live stream active.'}
            </Text>
          )}
        </Text>
      </View>

      {disconnected ? (
        <Card>
          <StateBlock
            kind="offline"
            title="Machine offline"
            text={
              machine.deviceName !== '—'
                ? `“${machine.deviceName}” has not reported recently. Sensor values show the last known state.`
                : 'No machine data available.'
            }
            action={loading ? undefined : 'Refresh'}
            onAction={refresh}
          />
        </Card>
      ) : (
        <>
          {/* Sensors — real telemetry */}
          <Card>
            <CardHead
              icon={<ActivityIcon size={15} color={theme.text3} />}
              title="Live sensor readings"
              action={
                <Badge tone="success">
                  {telemetry ? timeAgo(telemetry.recordedAt) : 'Awaiting data'}
                </Badge>
              }
            />
            <View style={{ marginTop: 4 }}>
              {sensors.map((s, idx) => {
                const noData = s.history.length === 0
                return (
                  <View
                    key={s.id}
                    style={[
                      styles.sensorRow,
                      idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <SensorGlyph id={s.id} color={theme.text3} />
                        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '700', color: theme.text, flexShrink: 1 }}>
                          {s.label}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 11, color: theme.text3, fontWeight: '600', marginTop: 3 }}>
                        Target {s.target} {s.unit}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Badge tone={noData ? 'neutral' : s.status === 'nominal' ? 'success' : s.status === 'warning' ? 'warning' : 'danger'}>
                        {noData ? '—' : s.status === 'nominal' ? 'Nominal' : s.status === 'warning' ? 'Off-target' : 'Critical'}
                      </Badge>
                      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
                        {!noData && <Sparkline data={s.history} status={s.status} />}
                        <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text }}>
                          {noData ? '—' : s.value.toFixed(s.decimals ?? 0)}
                          {!noData && <Text style={{ fontSize: 10.5, color: theme.text3, fontWeight: '700' }}> {s.unit}</Text>}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          </Card>

          {/* Subsystems */}
          <Card>
            <CardHead icon={<CpuIcon size={15} color={theme.text3} />} title="Subsystem status" />
            <View style={styles.subGrid}>
              {subsystems.map((sub) => {
                const on = sub.state === 'on'
                return (
                  <View
                    key={sub.key}
                    style={[
                      styles.subCard,
                      { backgroundColor: theme.surface2, borderColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.subIcon,
                        { backgroundColor: theme.surface, borderColor: theme.border },
                      ]}
                    >
                      <SubsystemGlyph id={sub.key} color={on ? theme.accentStrong : theme.text3} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '800', color: theme.text }}>
                        {sub.label}
                      </Text>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: theme.text2 }}>
                        {sub.detail}
                      </Text>
                    </View>
                    <View
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: on ? theme.green500 : theme.text3,
                      }}
                    />
                  </View>
                )
              })}
            </View>
          </Card>

          {/* Session control — guarded commands */}
          <Card>
            <CardHead
              icon={<PlayIcon size={15} color={theme.text3} />}
              title="Session control"
              action={
                <Badge tone={machine.status === 'paused' ? 'warning' : machine.status === 'extruding' ? 'accent' : 'neutral'} dot>
                  {machine.status === 'extruding'
                    ? 'Extruding'
                    : machine.status === 'heating'
                      ? 'Heating'
                      : machine.status === 'paused'
                        ? 'Paused'
                        : machine.status === 'offline'
                          ? 'Offline'
                          : 'Idle'}
                </Badge>
              }
            />
            <View style={{ padding: spacing.lg, gap: spacing.md }}>
              {currentSession ? (
                <>
                  <Text style={{ fontSize: 12.5, color: theme.text2, lineHeight: 18 }}>
                    Session started {timeAgo(currentSession.startedAt)}
                    {currentSession.materialInput != null
                      ? ` · ${Math.round(currentSession.materialInput)} g PET loaded`
                      : ''}
                    . Commands are validated by the backend before reaching the machine.
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    {machine.status === 'paused' ? (
                      <AppButton variant="success" style={{ flex: 1 }} disabled={busy} onPress={() => run(resumeSession, 'Resumed')}>
                        <ButtonContent icon={<PlayIcon size={16} color={theme.success} />} label="Resume" color={theme.success} />
                      </AppButton>
                    ) : (
                      <AppButton variant="secondary" style={{ flex: 1 }} disabled={busy} onPress={() => run(pauseSession, 'Paused')}>
                        <ButtonContent icon={<PauseIcon size={16} color={theme.text} />} label="Pause" color={theme.text} />
                      </AppButton>
                    )}
                    <AppButton variant="danger" style={{ flex: 1 }} disabled={busy} onPress={() => setConfirmStop(true)}>
                      Stop
                    </AppButton>
                  </View>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 12.5, color: theme.text2, lineHeight: 18 }}>
                    No session is running. The guarded command pipeline (start · pause · resume ·
                    stop · setTargetTemperature · setMotorSpeed · setFan) is live end-to-end —
                    session start from the app arrives with the firmware phase.
                  </Text>
                  <AppButton
                    variant="secondary"
                    disabled={busy}
                    onPress={() => run(() => sendCommand('start'), 'Start command sent')}
                  >
                    <ButtonContent icon={<PlayIcon size={16} color={theme.text} />} label="Send start command" color={theme.text} />
                  </AppButton>
                </>
              )}
            </View>
          </Card>
        </>
      )}

      {/* Stop confirmation */}
      <Sheet
        open={confirmStop}
        onClose={() => setConfirmStop(false)}
        title="Stop this session?"
        subtitle="A stop command will be validated by the backend and sent to the machine."
        actions={
          <>
            <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setConfirmStop(false)}>
              Keep running
            </AppButton>
            <AppButton
              variant="danger"
              style={{ flex: 1 }}
              disabled={busy}
              onPress={() => {
                setConfirmStop(false)
                void run(stopSession, 'Stop command sent')
              }}
            >
              Stop session
            </AppButton>
          </>
        }
      >
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            backgroundColor: theme.surface2,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            padding: spacing.md,
          }}
        >
          <CheckCircleIcon size={16} color={theme.text3} />
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: theme.text2 }}>
            Stopping ramps the heater down safely and winds the remaining filament onto the spool.
            The machine confirms completion through telemetry.
          </Text>
        </View>
      </Sheet>
    </ScrollView>
  )
}

function SensorGlyph({ id, color }: { id: string; color: string }) {
  switch (id) {
    case 'temp':
      return <ThermometerIcon size={15} color={color} />
    case 'motor':
      return <CpuIcon size={15} color={color} />
    case 'fan':
      return <FanIcon size={15} color={color} />
    default:
      return <ActivityIcon size={15} color={color} />
  }
}

function SubsystemGlyph({ id, color }: { id: string; color: string }) {
  switch (id) {
    case 'heater':
      return <ThermometerIcon size={16} color={color} />
    case 'motor':
      return <CpuIcon size={16} color={color} />
    case 'cooling':
      return <FanIcon size={16} color={color} />
    default:
      return <SpoolerIcon size={16} color={color} />
  }
}

const styles = StyleSheet.create({
  sensorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  subGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 10,
  },
  subCard: {
    flexBasis: '47.5%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 11,
    backgroundColor: 'transparent',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  subIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
})

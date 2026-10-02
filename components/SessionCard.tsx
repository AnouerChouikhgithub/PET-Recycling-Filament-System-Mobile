import { StyleSheet, Text, View } from 'react-native'

import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { timeAgo } from '../lib/format'
import { radius, spacing } from '../theme/tokens'
import { AppButton, Badge, ButtonContent, Card } from './ui'
import { PauseIcon, PlayIcon, RecycleIcon, StopIcon } from './icons'

const STATUS_META: Record<string, { label: string; tone: 'warning' | 'accent' | 'neutral' | 'danger' | 'success' }> = {
  heating: { label: 'Heating up', tone: 'warning' },
  extruding: { label: 'Extruding', tone: 'accent' },
  paused: { label: 'Paused', tone: 'warning' },
  idle: { label: 'Idle', tone: 'neutral' },
  offline: { label: 'Offline', tone: 'danger' },
}

export function SessionCard({ onStartSession }: { onStartSession?: () => void }) {
  const { machine, currentSession, telemetry, pauseSession, resumeSession, stopSession } = useMachine()
  const { theme } = useTheme()

  if (!currentSession) {
    return (
      <Card>
        <View style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: spacing.lg }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accentSoft,
              marginBottom: spacing.sm,
            }}
          >
            <RecycleIcon size={24} color={theme.accentStrong} />
          </View>
          <Text style={{ fontSize: 14, fontWeight: '800', color: theme.text }}>No active session</Text>
          <Text
            style={{
              fontSize: 12,
              color: theme.text2,
              textAlign: 'center',
              marginTop: 4,
              lineHeight: 17,
              marginBottom: spacing.md,
            }}
          >
            {machine.connected
              ? 'The machine is idle. Start a run from the machine once firmware control lands.'
              : 'The machine is offline — last known state shown.'}
          </Text>
          {onStartSession && machine.connected && (
            <AppButton size="sm" onPress={onStartSession}>
              Start a session
            </AppButton>
          )}
        </View>
      </Card>
    )
  }

  const meta = STATUS_META[machine.status] ?? STATUS_META.idle
  const paused = currentSession.status === 'paused'
  const temp = telemetry?.temperature

  return (
    <Card>
      <View style={styles.top}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.accentSoft,
          }}
        >
          <RecycleIcon size={20} color={theme.accentStrong} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.text }}>
            Session running
          </Text>
          <Text style={{ fontSize: 12, color: theme.text2 }}>
            {paused ? 'Paused' : 'Running'} · started {timeAgo(currentSession.startedAt)}
          </Text>
        </View>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </View>

      <View style={styles.body}>
        <View style={styles.statsRow}>
          <MiniStat k="PET loaded" v={currentSession.materialInput != null ? `${Math.round(currentSession.materialInput)} g` : '—'} />
          <MiniStat k="Extruder" v={temp != null ? `${temp.toFixed(0)}°C` : '—'} />
          <MiniStat
            k="Output"
            v={currentSession.materialOutput != null ? `${Math.round(currentSession.materialOutput)} g` : 'pending'}
          />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {paused ? (
            <AppButton variant="success" size="sm" style={{ flex: 1 }} onPress={() => void resumeSession()}>
              <ButtonContent icon={<PlayIcon size={15} color={theme.success} />} label="Resume" color={theme.success} size="sm" />
            </AppButton>
          ) : (
            <AppButton variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => void pauseSession()}>
              <ButtonContent icon={<PauseIcon size={15} color={theme.text} />} label="Pause" color={theme.text} size="sm" />
            </AppButton>
          )}
          <AppButton variant="danger" size="sm" style={{ flex: 1 }} onPress={() => void stopSession()}>
            <ButtonContent icon={<StopIcon size={14} color={theme.danger} />} label="Stop" color={theme.danger} size="sm" />
          </AppButton>
        </View>
      </View>
    </Card>
  )
}

function MiniStat({ k, v }: { k: string; v: string }) {
  const { theme } = useTheme()
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.surface2,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
        paddingHorizontal: 10,
        paddingVertical: 9,
        gap: 1,
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text3, letterSpacing: 0.5 }}>
        {k.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 14.5, fontWeight: '800', color: theme.text }}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  body: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.md,
    gap: 10,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
})

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'

import { useMachine } from '../../contexts/MachineContext'
import { useTheme } from '../../contexts/ThemeContext'
import type { AgentErrorKind } from '../../lib/agentContract'
import type { AgentNotice } from '../../lib/useAgentChat'
import {
  describeTelemetryFreshness,
  formatAgeSeconds,
  freshnessLabelText,
  type FreshnessLabel,
} from '../../lib/telemetryFreshness'
import { radius, spacing, type as t } from '../../theme/tokens'
import { AlertOctagonIcon, ClockIcon, InfoIcon, WarningIcon, XIcon } from '../icons'
import { AppButton, Badge, StateBlock, type BadgeTone } from '../ui'

const FRESHNESS_TONE: Record<FreshnessLabel, BadgeTone> = {
  fresh: 'success',
  stale: 'warning',
  very_stale: 'danger',
  unknown: 'neutral',
}

/**
 * The machine data the assistant reads, with its real age. This is the ONLY
 * freshness signal the API exposes (tool results carry no timestamp), so the app
 * shows the age of the newest reported sample from the same backend record and
 * says plainly that answers can be out of date. It never claims a value is live.
 */
export function MachineDataStrip() {
  const { theme } = useTheme()
  const { machine, telemetry } = useMachine()
  const freshness = describeTelemetryFreshness(telemetry?.recordedAt)

  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Text style={{ ...t.head, color: theme.text }}>{machine.deviceName}</Text>
        <Badge tone={machine.connected ? 'success' : 'danger'} dot>
          {machine.connected ? 'connected' : 'offline'}
        </Badge>
        <Badge tone={FRESHNESS_TONE[freshness.label]}>
          {telemetry
            ? `data ${formatAgeSeconds(freshness.ageSeconds)} old · ${freshnessLabelText(freshness.label)}`
            : 'no telemetry yet'}
        </Badge>
      </View>
      <View style={{ flexDirection: 'row', gap: 7, marginTop: 7 }}>
        <InfoIcon size={13} color={theme.text3} />
        <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16, color: theme.text2 }}>
          Answers below use the machine&apos;s last reported data — they can be out of date. The
          assistant cannot change any setting.
        </Text>
      </View>
    </View>
  )
}

/** Title per failure class. Nothing here ever echoes a server payload. */
export function noticeTitle(kind: AgentErrorKind): string {
  switch (kind) {
    case 'disabled':
      return 'Assistant unavailable'
    case 'rate_limited':
      return 'Too many messages'
    case 'daily_cap':
      return 'Daily AI limit reached'
    case 'conversation_missing':
      return 'Conversation no longer exists'
    case 'validation':
      return 'Message not sent'
    case 'auth':
      return 'Session expired'
    case 'malformed':
      return 'Unexpected answer'
    default:
      return 'No answer produced'
  }
}

/**
 * A failed turn. It is never rendered as an assistant bubble: the question stays
 * on screen and this notice explains what happened (with an explicit Retry only
 * when the failure is transient).
 */
export function FailureNotice({
  notice,
  canRetry,
  onRetry,
  onDismiss,
}: {
  notice: AgentNotice
  canRetry: boolean
  onRetry: () => void
  onDismiss: () => void
}) {
  const { theme } = useTheme()
  const danger = notice.kind !== 'rate_limited' && notice.kind !== 'daily_cap'

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[
        styles.notice,
        {
          backgroundColor: danger ? theme.dangerBg : theme.warningBg,
          borderColor: danger ? theme.dangerBg : theme.warningBg,
        },
      ]}
    >
      {danger ? (
        <AlertOctagonIcon size={17} color={theme.danger} />
      ) : (
        <ClockIcon size={17} color={theme.warning} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...t.head, color: danger ? theme.danger : theme.warning }}>
          {noticeTitle(notice.kind)}
        </Text>
        <Text style={{ ...t.sub, color: theme.text, lineHeight: 17, marginTop: 2 }}>
          {notice.message}
        </Text>
        {notice.retryable && canRetry && (
          <AppButton size="sm" variant="secondary" style={{ marginTop: 9, alignSelf: 'flex-start' }} onPress={onRetry}>
            Retry
          </AppButton>
        )}
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss message"
        style={{ padding: 2 }}
      >
        <XIcon size={15} color={theme.text2} />
      </Pressable>
    </View>
  )
}

/** Rate-limit / daily-cap state with the remaining wait from Retry-After. */
export function RateLimitBanner({ seconds }: { seconds: number }) {
  const { theme } = useTheme()
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: theme.warningBg, borderColor: theme.warningBg }]}
    >
      <ClockIcon size={17} color={theme.warning} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...t.head, color: theme.warning }}>Too many messages</Text>
        <Text style={{ ...t.sub, color: theme.text, lineHeight: 17, marginTop: 2 }}>
          You can send another question in {seconds}s.
        </Text>
      </View>
    </View>
  )
}

/** Shown when the machine's newest sample is stale — dismissable per session. */
export function StaleDataBanner({
  ageSeconds,
  label,
  onDismiss,
}: {
  ageSeconds: number | null
  label: FreshnessLabel
  onDismiss: () => void
}) {
  const { theme } = useTheme()
  const veryStale = label === 'very_stale'

  return (
    <View
      style={[
        styles.notice,
        { backgroundColor: veryStale ? theme.dangerBg : theme.warningBg, borderColor: theme.border },
      ]}
    >
      <WarningIcon size={17} color={veryStale ? theme.danger : theme.warning} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ ...t.sub, color: theme.text, lineHeight: 17 }}>
          <Text style={{ fontWeight: '800' }}>
            {veryStale ? 'Telemetry is more than 10 minutes old. ' : `Telemetry is ${formatAgeSeconds(ageSeconds)} old. `}
          </Text>
          Values the assistant reads may no longer match the machine, so it may not report the
          current heater or motor state.
        </Text>
      </View>
      <Pressable
        onPress={onDismiss}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Dismiss stale data warning"
        style={{ padding: 2 }}
      >
        <XIcon size={15} color={theme.text2} />
      </Pressable>
    </View>
  )
}

/** 404 without AGENT_NOT_FOUND: the whole assistant surface is switched off. */
export function AssistantUnavailable() {
  const { theme } = useTheme()
  return (
    <View style={[styles.strip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <StateBlock
        kind="offline"
        title="Assistant not available"
        text="The AI assistant is switched off on this server right now. Your machines, sessions and recycling data are unaffected."
      />
    </View>
  )
}

/** Pending-turn indicator (announced for screen readers). */
export function ThinkingRow() {
  const { theme } = useTheme()
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: spacing.lg }}
    >
      <ActivityIndicator size="small" color={theme.accentStrong} />
      <Text style={{ ...t.sub, color: theme.text2 }}>Checking your machine data…</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  strip: {
    gap: 2,
    marginHorizontal: spacing.lg,
    padding: spacing.md + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
  notice: {
    flexDirection: 'row',
    gap: 10,
    marginHorizontal: spacing.lg,
    padding: spacing.md + 2,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
})

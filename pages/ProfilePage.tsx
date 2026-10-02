import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useState } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { timeAgo } from '../lib/format'
import { radius, spacing } from '../theme/tokens'
import { AppButton, Badge, Card, CardHead, Sheet, Toggle } from '../components/ui'
import {
  BellIcon,
  CheckCircleIcon,
  CheckIcon,
  CpuIcon,
  FlaskIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  MoonIcon,
  RefreshIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from '../components/icons'
import type { ThemeMode } from '../data/types'

export function ProfilePage() {
  const { theme, mode, setMode, resolved } = useTheme()
  const { user, logout } = useAuth()
  const {
    machine,
    alerts,
    markAllAlertsRead,
    machines,
    selectMachine,
    telemetry,
    realtimeMode,
    refresh,
  } = useMachine()
  const insets = useSafeAreaInsets()
  const [aboutOpen, setAboutOpen] = useState(false)
  const [signOutOpen, setSignOutOpen] = useState(false)

  const unread = alerts.filter((a) => !a.read).length

  const themeOptions: { value: ThemeMode; label: string; light: boolean; dark: boolean }[] = [
    { value: 'light', label: 'Light', light: true, dark: false },
    { value: 'dark', label: 'Dark', light: false, dark: true },
    { value: 'system', label: 'Auto', light: true, dark: true },
  ]

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
      {/* Profile hero — from the backend (/api/me) */}
      <Card>
        <View style={{ alignItems: 'center', gap: 3, paddingVertical: spacing.xl, paddingHorizontal: spacing.lg }}>
          <View
            style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accent,
              marginBottom: 5,
            }}
          >
            <Text style={{ color: theme.accentContrast, fontSize: 24, fontWeight: '800' }}>
              {user?.name.charAt(0) ?? '?'}
            </Text>
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: theme.text }}>{user?.name ?? '—'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MailIcon size={12} color={theme.text2} />
            <Text style={{ fontSize: 12.5, color: theme.text2 }}>{user?.email ?? '—'}</Text>
          </View>
          <View style={{ marginTop: 6 }}>
            <Badge tone={machine.connected ? 'success' : 'danger'} dot>
              {machine.deviceName} · {machine.connected ? 'connected' : 'offline'}
            </Badge>
          </View>
        </View>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHead
          icon={resolved === 'dark' ? <MoonIcon size={15} color={theme.text3} /> : <SunIcon size={15} color={theme.text3} />}
          title="Appearance"
        />
        <View style={styles.themeRow}>
          {themeOptions.map((o) => {
            const active = mode === o.value
            return (
              <Pressable
                key={o.value}
                onPress={() => setMode(o.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={[
                  styles.themeCard,
                  {
                    borderColor: active ? theme.accent : theme.borderStrong,
                    backgroundColor: active ? theme.accentSoft : theme.surface,
                  },
                ]}
              >
                <View
                  style={{
                    width: '100%',
                    height: 34,
                    borderRadius: 8,
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: theme.border,
                    flexDirection: 'row',
                    overflow: 'hidden',
                  }}
                >
                  <View style={{ flex: o.light ? 1 : 0, backgroundColor: '#f6f8f6' }} />
                  <View style={{ flex: o.dark ? 1 : 0, backgroundColor: '#1a201d' }} />
                </View>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: active ? theme.accentStrong : theme.text2,
                  }}
                >
                  {o.label}
                </Text>
                {active && <CheckIcon size={14} color={theme.accentStrong} />}
              </Pressable>
            )
          })}
        </View>
      </Card>

      {/* Notifications */}
      <Card>
        <CardHead icon={<BellIcon size={15} color={theme.text3} />} title="Notifications" />
        <View style={{ marginTop: 4 }}>
          <ToggleRow
            icon={<CheckCircleIcon size={16} color={theme.text2} />}
            label="Session complete"
            sub="When a recycling session finishes"
            on
            onChange={() => {}}
          />
          <ToggleRow
            icon={<CpuIcon size={16} color={theme.text2} />}
            label="Machine alerts"
            sub="Offline detection and session failures"
            on
            onChange={() => {}}
          />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.md }}>
          <AppButton variant="ghost" size="sm" onPress={markAllAlertsRead}>
            Mark all {unread > 0 ? `${unread} ` : ''}notifications as read
          </AppButton>
        </View>
      </Card>

      {/* Machine */}
      <Card>
        <CardHead
          icon={<SettingsIcon size={15} color={theme.text3} />}
          title="Machines"
          action={<Badge tone={realtimeMode === 'polling' ? 'neutral' : 'success'}>{realtimeMode === 'polling' ? '10 s refresh' : 'live'}</Badge>}
        />
        <View style={{ marginTop: 4 }}>
          {machines.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => selectMachine(m.id)}
              style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}
            >
              <View style={[styles.rowMedia, { backgroundColor: theme.surface2 }]}>
                <CpuIcon size={16} color={theme.text2} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>{m.name}</Text>
                <Text style={{ fontSize: 12, color: theme.text2 }}>
                  {m.identifier} · {m.status}
                </Text>
              </View>
              {m.id === machine.deviceName && <Badge tone="accent">active</Badge>}
            </Pressable>
          ))}
          <Row
            icon={<RefreshIcon size={16} color={theme.text2} />}
            label="Last report"
            sub={machine.lastSeenLabel}
          />
          <Row
            icon={<ShieldIcon size={16} color={theme.text2} />}
            label="Latest telemetry"
            sub={telemetry ? `${telemetry.temperature != null ? `${telemetry.temperature.toFixed(1)}°C · ` : ''}${timeAgo(telemetry.recordedAt)}` : 'no samples yet'}
          />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.md }}>
          <AppButton variant="secondary" size="sm" onPress={refresh}>
            Refresh from backend
          </AppButton>
        </View>
      </Card>

      {/* Account */}
      <Card>
        <CardHead icon={<UserIcon size={15} color={theme.text3} />} title="Account" />
        <View style={{ marginTop: 4 }}>
          <Row
            icon={<MailIcon size={16} color={theme.text2} />}
            label="Signed in as"
            sub={user?.email ?? '—'}
          />
          <Row
            icon={<MapPinIcon size={16} color={theme.text2} />}
            label="Member since"
            sub={user ? new Date(user.createdAt).toLocaleDateString() : '—'}
          />
        </View>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: 4, paddingBottom: spacing.md }}>
          <AppButton variant="danger" size="sm" onPress={() => setSignOutOpen(true)}>
            Sign out
          </AppButton>
        </View>
      </Card>

      {/* App */}
      <Card>
        <CardHead icon={<InfoIcon size={15} color={theme.text3} />} title="App" />
        <View style={{ marginTop: 4 }}>
          <LinkRow
            icon={<InfoIcon size={16} color={theme.accentStrong} />}
            iconBg={theme.accentSoft}
            label="About 3awedlou"
            sub="Version, ecosystem, backend"
            onPress={() => setAboutOpen(true)}
          />
        </View>
      </Card>

      {/* About sheet */}
      <Sheet
        open={aboutOpen}
        onClose={() => setAboutOpen(false)}
        title="About 3awedlou"
        subtitle="Mobile companion · v0.1.0"
      >
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            backgroundColor: theme.accentSoft,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.accentBorder,
            padding: spacing.md,
          }}
        >
          <FlaskIcon size={16} color={theme.accentStrong} />
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: theme.text }}>
            <Text style={{ fontWeight: '800' }}>Used PET → 3awedlou machine → filament → 3D printing.</Text>{' '}
            This app is the digital companion of the physical machine: monitor sessions, manage
            filament batches and track your impact.
          </Text>
        </View>
        <Card style={{ padding: spacing.lg }}>
          <SpecRow k="App version" v="0.1.0 (React Native / Expo)" />
          <SpecRow k="Backend" v="Symfony API (shared with web)" />
          <SpecRow k="Device" v={machine.deviceName} />
          <SpecRow k="Data source" v={realtimeMode === 'polling' ? 'API polling · 10 s' : 'Live stream'} />
        </Card>
      </Sheet>

      {/* Sign-out confirm */}
      <Sheet
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        subtitle="Your session token will be removed from this device."
        actions={
          <>
            <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setSignOutOpen(false)}>
              Cancel
            </AppButton>
            <AppButton
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => {
                setSignOutOpen(false)
                void logout()
              }}
            >
              Sign out
            </AppButton>
          </>
        }
      >
        <View style={{ height: 1 }} />
      </Sheet>
    </ScrollView>
  )
}

function Row({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  const { theme } = useTheme()
  return (
    <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={[styles.rowMedia, { backgroundColor: theme.surface2 }]}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>{label}</Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: theme.text2 }}>{sub}</Text>
      </View>
    </View>
  )
}

function ToggleRow({
  icon,
  label,
  sub,
  on,
  onChange,
}: {
  icon: React.ReactNode
  label: string
  sub: string
  on: boolean
  onChange: (v: boolean) => void
}) {
  const { theme } = useTheme()
  return (
    <View style={[styles.row, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border }]}>
      <View style={[styles.rowMedia, { backgroundColor: theme.surface2 }]}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: theme.text2 }}>{sub}</Text>
      </View>
      <Toggle on={on} onChange={onChange} label={label} />
    </View>
  )
}

function LinkRow({
  icon,
  iconBg,
  label,
  sub,
  onPress,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  sub: string
  onPress: () => void
}) {
  const { theme } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.rowMedia, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: theme.text2 }}>{sub}</Text>
      </View>
    </Pressable>
  )
}

function SpecRow({ k, v }: { k: string; v: string }) {
  const { theme } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 11,
        gap: spacing.md,
      }}
    >
      <Text style={{ fontSize: 12.5, color: theme.text2, fontWeight: '600' }}>{k}</Text>
      <Text style={{ fontSize: 13, fontWeight: '800', color: theme.text, textAlign: 'right' }}>{v}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  themeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: 10,
  },
  themeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    padding: 9,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  rowMedia: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing, radius } from '../theme/tokens'
import { timeAgo } from '../lib/format'
import { Badge, Card, IconBtn, Sheet } from './ui'
import {
  BarChartIcon,
  BellIcon,
  CpuIcon,
  HomeIcon,
  LogoIcon,
  MoonIcon,
  RecycleIcon,
  SunIcon,
  UserIcon,
  WifiIcon,
} from './icons'

/* ============ Top app header ============ */

export function AppHeader({
  title,
  subtitle,
  onToggleTheme,
  onOpenNotifications,
  unread,
}: {
  title: string
  subtitle: string
  onToggleTheme: () => void
  onOpenNotifications: () => void
  unread: number
}) {
  const { theme, resolved } = useTheme()
  return (
    <View style={{ backgroundColor: theme.bg }}>
      <View style={styles.headerInner}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            backgroundColor: theme.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LogoIcon size={20} color={theme.accentContrast} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md, marginRight: spacing.sm, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
            {title}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 11, color: theme.text2, marginTop: 1 }}>
            {subtitle}
          </Text>
        </View>
        <IconBtn onPress={onToggleTheme} accessibilityLabel="Toggle theme">
          {resolved === 'dark' ? (
            <SunIcon size={18} color={theme.text2} />
          ) : (
            <MoonIcon size={18} color={theme.text2} />
          )}
        </IconBtn>
        <View>
          <IconBtn onPress={onOpenNotifications} accessibilityLabel="Notifications">
            <BellIcon size={18} color={theme.text2} />
          </IconBtn>
          {unread > 0 && (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 17,
                height: 17,
                paddingHorizontal: 4,
                borderRadius: radius.full,
                backgroundColor: theme.danger,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: theme.surface,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 10.5, fontWeight: '800' }}>{unread}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

/* ============ Connection ribbon ============ */

export function ConnectionRibbon() {
  const { machine, realtimeMode, refresh } = useMachine()
  const { theme } = useTheme()

  if (machine.connected) {
    return (
      <View style={{ backgroundColor: theme.accentSoft }}>
        <View style={styles.ribbonInner}>
          <WifiIcon size={13} color={theme.accentStrong} />
          <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: theme.accentStrong }}>
            Connected · 3awedlou backend · {realtimeMode === 'polling' ? '10 s refresh' : 'live'}
          </Text>
        </View>
      </View>
    )
  }
  return (
    <View style={{ backgroundColor: theme.dangerBg }}>
      <View style={styles.ribbonInner}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.danger }} />
        <Text style={{ flex: 1, fontSize: 11.5, fontWeight: '600', color: theme.danger }}>
          Machine offline — last report {machine.lastSeenLabel}
        </Text>
        <Pressable hitSlop={6} onPress={refresh}>
          <Text style={{ fontSize: 11.5, fontWeight: '800', color: theme.danger }}>
            Refresh
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

/* ============ Bottom tab bar ============ */

export type TabRoute = 'Home' | 'Machine' | 'Recycling' | 'Impact' | 'Profile'

const TAB_META: { route: TabRoute; label: string; icon: (c: string) => ReactNode }[] = [
  { route: 'Home', label: 'Home', icon: (c) => <HomeIcon size={21} color={c} /> },
  { route: 'Machine', label: 'Machine', icon: (c) => <CpuIcon size={21} color={c} /> },
  { route: 'Recycling', label: 'Recycle', icon: (c) => <RecycleIcon size={21} color={c} /> },
  { route: 'Impact', label: 'Impact', icon: (c) => <BarChartIcon size={21} color={c} /> },
  { route: 'Profile', label: 'Profile', icon: (c) => <UserIcon size={21} color={c} /> },
]

export function TabBar({
  active,
  onChange,
  unreadAlerts,
}: {
  active: TabRoute
  onChange: (r: TabRoute) => void
  unreadAlerts: number
}) {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()

  return (
    <View
      style={{
        backgroundColor: theme.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.border,
        paddingBottom: insets.bottom,
      }}
    >
      <View style={styles.tabRow}>
        {TAB_META.map((t) => {
          const isActive = t.route === active
          const color = isActive ? theme.accentStrong : theme.text3
          return (
            <Pressable
              key={t.route}
              onPress={() => onChange(t.route)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={styles.tab}
            >
              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 4,
                  borderRadius: radius.full,
                  backgroundColor: isActive ? theme.accentSoft : 'transparent',
                }}
              >
                {t.icon(color)}
              </View>
              <Text style={{ fontSize: 10.5, fontWeight: '600', color, marginTop: 3 }}>
                {t.label}
              </Text>
              {t.route === 'Machine' && unreadAlerts > 0 && (
                <View
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: '28%',
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: radius.full,
                    backgroundColor: theme.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderWidth: 2,
                    borderColor: theme.surface,
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
                    {unreadAlerts}
                  </Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

/* ============ Notifications sheet ============ */

export function NotificationsSheet({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { alerts, markAlertRead, markAllAlertsRead, unreadAlerts } = useMachine()
  const { theme } = useTheme()

  const sevTone = {
    success: 'success',
    info: 'info',
    warning: 'warning',
    error: 'danger',
  } as const

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Notifications"
      subtitle={unreadAlerts > 0 ? `${unreadAlerts} unread` : 'You are all caught up'}
      actions={
        <Pressable
          onPress={markAllAlertsRead}
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 46,
            borderRadius: radius.md,
            backgroundColor: theme.surface2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.borderStrong,
          }}
        >
          <Text style={{ color: theme.text, fontSize: 14.5, fontWeight: '700' }}>
            Mark all as read
          </Text>
        </Pressable>
      }
    >
      {alerts.length === 0 && (
        <Text style={{ textAlign: 'center', color: theme.text2, paddingVertical: 20, fontSize: 13 }}>
          No notifications yet.
        </Text>
      )}
      {alerts.map((a) => (
        <Pressable
          key={a.id}
          onPress={() => markAlertRead(a.id)}
          style={{
            flexDirection: 'row',
            gap: 11,
            padding: spacing.md,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            backgroundColor: theme.surface2,
            opacity: a.read ? 0.72 : 1,
          }}
        >
          <Badge tone={sevTone[a.severity]}>{a.severity}</Badge>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: theme.text }}>
              {a.title}
            </Text>
            <Text style={{ fontSize: 12, color: theme.text2, lineHeight: 17, marginTop: 2 }}>
              {a.message}
            </Text>
            <Text style={{ fontSize: 10.5, color: theme.text3, fontWeight: '600', marginTop: 4 }}>
              {timeAgo(a.date)}
            </Text>
          </View>
          {!a.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.accent, marginTop: 5 }} />}
        </Pressable>
      ))}
    </Sheet>
  )
}

/* ============ Footer note ============ */

export function AppFooter() {
  const { theme } = useTheme()
  return (
    <Card style={{ marginBottom: spacing.sm }}>
      <View style={{ alignItems: 'center', padding: spacing.lg, gap: 3 }}>
        <Text style={{ fontSize: 10.5, color: theme.text3, textAlign: 'center', lineHeight: 16 }}>
          3awedlou · Smart PET recycling to 3D-printing filament
        </Text>
        <Text style={{ fontSize: 10.5, color: theme.text3, textAlign: 'center' }}>
          Powered by the 3awedlou backend — web & mobile, one API
        </Text>
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  headerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    height: 56,
    gap: spacing.sm,
  },
  ribbonInner: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.lg,
    paddingVertical: 7,
  },
  tabRow: {
    flexDirection: 'row',
    height: 62,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

import { useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'

import { useAuth } from '../contexts/AuthContext'
import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { formatNumber, timeAgo } from '../lib/format'
import { spacing, radius } from '../theme/tokens'
import { Gauge } from '../components/charts'
import { SessionCard } from '../components/SessionCard'
import { AppFooter } from '../components/Shell'
import { Card, CardHead, StateBlock } from '../components/ui'
import {
  ActivityIcon,
  BottleIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  RecycleIcon,
  SpoolerIcon,
  WarningIcon,
} from '../components/icons'

export function HomePage() {
  const { theme } = useTheme()
  const { user } = useAuth()
  const { machine, sensors, currentSession, alerts, recyclingTotals, refresh, loading, error } = useMachine()
  const navigation = useNavigation()
  const insets = useSafeAreaInsets()
  const [temp, motor, fan] = sensors
  const userName = user?.name.split(' ')[0] ?? 'there'

  // Greeting ticks so "started X min ago" labels stay fresh.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  const petKg = (recyclingTotals.inputGrams ?? 0) / 1000
  const filamentKg = (recyclingTotals.outputGrams ?? 0) / 1000

  const recentAlerts = alerts.slice(0, 4)

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
      {/* Hero */}
      <View style={{ gap: 3 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: theme.text3 }}>
          GOOD TO SEE YOU, {userName.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -0.5, color: theme.text, lineHeight: 30 }}>
          {currentSession ? 'Your machine is recycling.' : machine.connected ? 'Your machine is ready.' : 'Machine is offline.'}
        </Text>
        <Text style={{ fontSize: 13, color: theme.text2, lineHeight: 19 }}>
          {machine.connected
            ? currentSession
              ? 'Session running — turning used PET into fresh filament.'
              : 'Connected to the 3awedlou backend and reporting.'
            : 'The machine has not reported recently. Check its connection.'}
        </Text>
      </View>

      {/* Live sensor strip — real telemetry */}
      <Card>
        <CardHead
          icon={<ActivityIcon size={15} color={theme.text3} />}
          title="Live readings"
          action={
            <Pressable hitSlop={6} onPress={() => navigation.navigate('Machine' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accentStrong }}>Details</Text>
              <ChevronRightIcon size={13} color={theme.accentStrong} />
            </Pressable>
          }
        />
        {machine.connected && temp ? (
          <View style={styles.sensorStrip}>
            <Gauge value={temp.value} min={0} max={temp.max} label="Extruder" unit="°C" status={temp.status} target={temp.target} />
            <Gauge value={motor.value} min={0} max={motor.max} label="Motor" unit="RPM" status={motor.status} target={motor.target} />
            <Gauge value={fan.value} min={0} max={fan.max} label="Cooling" unit="%" status={fan.status} target={fan.target} />
          </View>
        ) : (
          <StateBlock
            kind={error ? 'offline' : 'empty'}
            title={error ? 'Backend unreachable' : 'No telemetry yet'}
            text={error ? (error as string) : 'Sensor readings appear once the machine starts reporting.'}
            action={error ? 'Retry' : undefined}
            onAction={error ? refresh : undefined}
          />
        )}
        {loading && !machine.connected && <Text style={{ fontSize: 11, color: theme.text3, textAlign: 'center', paddingBottom: 10 }}>Loading…</Text>}
      </Card>

      {/* Live session */}
      <SessionCard />

      {/* Quick stats — measured totals from the backend */}
      <View style={styles.tileRow}>
        <QuickTile
          icon={<BottleIcon size={17} color={theme.accentStrong} />}
          value={petKg.toFixed(1)}
          unit="kg"
          label="PET recycled"
        />
        <QuickTile
          icon={<SpoolerIcon size={17} color={theme.accentStrong} />}
          value={filamentKg.toFixed(1)}
          unit="kg"
          label="Filament total"
        />
        <QuickTile
          icon={<BottleIcon size={17} color={theme.accentStrong} />}
          value={`≈ ${formatNumber(Math.round(petKg * 25))}`}
          label="Bottles equiv."
        />
      </View>

      {/* Recent activity — derived from real machine state */}
      <Card>
        <CardHead
          icon={<ActivityIcon size={15} color={theme.text3} />}
          title="Recent activity"
          action={
            <Pressable hitSlop={6} onPress={() => navigation.navigate('History' as never)} style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.accentStrong }}>View all</Text>
              <ChevronRightIcon size={13} color={theme.accentStrong} />
            </Pressable>
          }
        />
        <View style={{ marginTop: 6 }}>
          {recentAlerts.length === 0 ? (
            <Text style={{ fontSize: 13, color: theme.text2, paddingHorizontal: spacing.lg, paddingVertical: 12 }}>
              Nothing to report — the machine is behaving normally.
            </Text>
          ) : (
            recentAlerts.map((ev) => {
              const isError = ev.severity === 'error'
              const isSuccess = ev.severity === 'success'
              return (
                <Pressable
                  key={ev.id}
                  onPress={() => navigation.navigate('History' as never)}
                  style={({ pressed }) => [
                    styles.row,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={[styles.rowMedia, { backgroundColor: isError ? theme.dangerBg : isSuccess ? theme.successBg : theme.surface3 }]}>
                    {isError ? (
                      <WarningIcon size={17} color={theme.danger} />
                    ) : isSuccess ? (
                      <CheckCircleIcon size={17} color={theme.success} />
                    ) : (
                      <RecycleIcon size={17} color={theme.text2} />
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>
                      {ev.title}
                    </Text>
                    <Text numberOfLines={1} style={{ fontSize: 12, color: theme.text2 }}>
                      {ev.message}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: theme.text3 }}>{timeAgo(ev.date)}</Text>
                </Pressable>
              )
            })
          )}
        </View>
      </Card>

      <AppFooter />
    </ScrollView>
  )
}

function QuickTile({
  icon,
  value,
  unit,
  label,
}: {
  icon: React.ReactNode
  value: string
  unit?: string
  label: string
}) {
  const { theme } = useTheme()
  return (
    <Card style={{ flex: 1, padding: spacing.md, gap: 7, minWidth: 0 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 17, fontWeight: '800', color: theme.text }}>
        {value}
        {unit && <Text style={{ fontSize: 11, color: theme.text2, fontWeight: '700' }}> {unit}</Text>}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: theme.text2, fontWeight: '600' }}>
        {label}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  sensorStrip: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
  },
  rowMedia: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

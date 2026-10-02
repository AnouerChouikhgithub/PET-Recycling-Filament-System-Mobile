import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect, useMemo, useState } from 'react'

import { machinesApi } from '../api'
import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { formatDateShort, timeAgo } from '../lib/format'
import { radius, spacing } from '../theme/tokens'
import { SessionCard } from '../components/SessionCard'
import {
  AppButton,
  Badge,
  ButtonContent,
  Card,
  Chip,
  Segmented,
  SESSION_BADGE,
  StateBlock,
} from '../components/ui'
import {
  BottleIcon,
  CalendarIcon,
  ChevronRightIcon,
  PlayIcon,
  RecycleIcon,
  SpoolerIcon,
} from '../components/icons'
import type { FilamentProduction, MachineSession } from '../data/api'

type Filter = 'all' | 'completed' | 'in_progress' | 'failed'

export function RecyclingPage() {
  const { theme } = useTheme()
  const { selectedId, sessions, recyclingTotals, refresh, loading } = useMachine()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<'sessions' | 'batches'>('sessions')
  const [filter, setFilter] = useState<Filter>('all')
  const [batches, setBatches] = useState<FilamentProduction[]>([])

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    machinesApi
      .production(selectedId, { limit: 50 })
      .then((rows) => {
        if (!cancelled) setBatches(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedId, sessions.length])

  const filtered = useMemo(
    () => sessions.filter((s) => (filter === 'all' ? true : s.status === filter)),
    [sessions, filter],
  )

  const petKg = (recyclingTotals.inputGrams ?? 0) / 1000
  const filKg = (recyclingTotals.outputGrams ?? 0) / 1000

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
      <View style={{ gap: 3 }}>
        <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: theme.text3 }}>
          RECYCLING
        </Text>
        <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -0.5, color: theme.text, lineHeight: 30 }}>
          Turn bottles into filament.
        </Text>
      </View>

      {/* Summary tiles — measured totals from the backend */}
      <View style={styles.tileRow}>
        <SummaryTile icon={<BottleIcon size={17} color={theme.accentStrong} />} value={petKg.toFixed(1)} unit="kg" label="PET recycled" />
        <SummaryTile icon={<SpoolerIcon size={17} color={theme.accentStrong} />} value={filKg.toFixed(1)} unit="kg" label="Filament made" />
        <SummaryTile icon={<CalendarIcon size={17} color={theme.accentStrong} />} value={String(recyclingTotals.records)} label="Records" />
      </View>

      {/* Live session */}
      <SessionCard />

      {/* History: sessions & batches */}
      <Card>
        <View style={{ padding: spacing.lg, paddingBottom: 10 }}>
          <Segmented
            options={[
              { value: 'sessions', label: 'Sessions' },
              { value: 'batches', label: 'Batches' },
            ]}
            value={tab}
            onChange={setTab}
          />
        </View>

        {tab === 'sessions' ? (
          <>
            <View style={styles.chipRow}>
              <Chip active={filter === 'all'} onPress={() => setFilter('all')}>All</Chip>
              <Chip active={filter === 'completed'} onPress={() => setFilter('completed')}>Done</Chip>
              <Chip active={filter === 'in_progress'} onPress={() => setFilter('in_progress')}>Running</Chip>
              <Chip active={filter === 'failed'} onPress={() => setFilter('failed')}>Failed</Chip>
            </View>
            <View>
              {filtered.map((s, idx) => (
                <SessionRow key={s.id} session={s} first={idx === 0} />
              ))}
              {filtered.length === 0 && (
                <StateBlock
                  kind={loading ? 'offline' : 'empty'}
                  title={loading ? 'Loading…' : 'Nothing here yet'}
                  text={loading ? 'Fetching session history from the backend.' : 'No sessions match this filter. Sessions appear once the machine runs.'}
                  action={loading ? undefined : 'Refresh'}
                  onAction={loading ? undefined : refresh}
                />
              )}
            </View>
          </>
        ) : (
          <BatchList batches={batches} />
        )}
      </Card>
    </ScrollView>
  )
}

/* ============ Summary tile ============ */

function SummaryTile({
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

/* ============ Session row ============ */

function SessionRow({
  session: s,
  first,
}: {
  session: MachineSession
  first: boolean
}) {
  const { theme } = useTheme()
  const badge = SESSION_BADGE[s.status]
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View
        style={[
          styles.rowMedia,
          {
            backgroundColor: s.status === 'failed' ? theme.dangerBg : theme.accentSoft,
          },
        ]}
      >
        <RecycleIcon size={17} color={s.status === 'failed' ? theme.danger : theme.accentStrong} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>
          {s.id.slice(0, 8)}
          <Text style={{ color: theme.text2 }}> · {formatDateShort(s.startedAt)}</Text>
        </Text>
        <Text numberOfLines={1} style={{ fontSize: 12, color: theme.text2 }}>
          {s.materialInput != null ? `${Math.round(s.materialInput)} g PET` : 'PET'} →
          {s.materialOutput != null ? ` ${Math.round(s.materialOutput)} g filament` : ' in progress'}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Badge tone={badge.tone}>{badge.label}</Badge>
        <ChevronRightIcon size={15} color={theme.text3} />
      </View>
    </Pressable>
  )
}

/* ============ Batch list ============ */

function BatchList({ batches }: { batches: FilamentProduction[] }) {
  const { theme } = useTheme()
  if (batches.length === 0) {
    return (
      <StateBlock
        kind="empty"
        title="No batches yet"
        text="Filament batches appear as the machine produces them."
      />
    )
  }
  return (
    <View>
      {batches.map((b, idx) => (
        <Pressable
          key={b.id}
          style={({ pressed }) => [
            styles.row,
            idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <View style={[styles.rowMedia, { backgroundColor: theme.surface3, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border }]}>
            <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: b.colorHex }} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>
              {b.batchCode} · {b.color}
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 12, color: theme.text2 }}>
              {Math.round(b.weightGrams)} g · {b.diameterTarget} mm · {timeAgo(b.producedAt)}
            </Text>
          </View>
          <ChevronRightIcon size={15} color={theme.text3} />
        </Pressable>
      ))}
    </View>
  )
}

/* ============ Shared styles ============ */

const styles = StyleSheet.create({
  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: 10,
    flexWrap: 'wrap',
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

// Keep AppButton/ButtonContent imports referenced for the upcoming inline start flow.
void AppButton
void ButtonContent
void PlayIcon

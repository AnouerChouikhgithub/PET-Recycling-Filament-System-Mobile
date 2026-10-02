import { useEffect, useMemo, useState } from 'react'
import { SectionList, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as Sharing from 'expo-sharing'
import { File, Paths } from 'expo-file-system'

import { machinesApi } from '../api'
import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import type { FilamentProduction, MachineAlert, MachineSession } from '../data/api'
import { dayLabel, timeAgo, toCsv } from '../lib/format'
import { spacing } from '../theme/tokens'
import {
  AppButton,
  Badge,
  ButtonContent,
  Card,
  ChevronHeader,
  Chip,
  SearchInput,
  Segmented,
  SESSION_BADGE,
  StateBlock,
} from '../components/ui'
import {
  AlertOctagonIcon,
  DownloadIcon,
  RecycleIcon,
  SpoolerIcon,
  WrenchIcon,
} from '../components/icons'

type Tab = 'sessions' | 'filament' | 'alerts'

interface TimelineItem {
  id: string
  date: string
  kind: Tab
  title: string
  sub: string
  badge?: { tone: 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral'; label: string }
  timeLabel?: string
  tone: { bg: string; color: string }
  glyph: 'session' | 'batch' | 'alertError' | 'alertWarn' | 'alertOk' | 'alertInfo'
}

export function HistoryPage() {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const { selectedId, sessions, alerts } = useMachine()
  const [tab, setTab] = useState<Tab>('sessions')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'failed'>('all')
  const [batches, setBatches] = useState<FilamentProduction[]>([])
  const [exportMsg, setExportMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    machinesApi
      .production(selectedId, { limit: 100 })
      .then((rows) => {
        if (!cancelled) setBatches(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const items = useMemo<TimelineItem[]>(() => {
    const q = query.trim().toLowerCase()
    if (tab === 'sessions') {
      return sessions
        .filter((s: MachineSession) => (statusFilter === 'all' ? true : s.status === statusFilter))
        .filter((s: MachineSession) =>
          q === '' ? true : s.id.toLowerCase().includes(q) || (s.notes ?? '').toLowerCase().includes(q),
        )
        .map((s: MachineSession) => ({
          id: `s-${s.id}`,
          date: s.startedAt,
          kind: 'sessions' as const,
          title: `Session ${s.id.slice(0, 8)}`,
          sub:
            s.status === 'in_progress' || s.status === 'paused'
              ? `${s.materialInput != null ? `${Math.round(s.materialInput)} g PET` : 'PET'} · running now`
              : `${s.materialInput != null ? `${Math.round(s.materialInput)} g PET` : 'PET'} → ${s.materialOutput != null ? `${Math.round(s.materialOutput)} g filament` : 'no output'}`,
          badge: SESSION_BADGE[s.status],
          tone:
            s.status === 'failed'
              ? { bg: theme.dangerBg, color: theme.danger }
              : { bg: theme.accentSoft, color: theme.accentStrong },
          glyph: 'session' as const,
        }))
    }
    if (tab === 'filament') {
      return batches
        .filter((b: FilamentProduction) =>
          q === '' ? true : b.batchCode.toLowerCase().includes(q) || b.color.toLowerCase().includes(q),
        )
        .map((b: FilamentProduction) => ({
          id: `b-${b.id}`,
          date: b.producedAt,
          kind: 'filament' as const,
          title: `Batch ${b.batchCode} · ${b.color}`,
          sub: `${Math.round(b.weightGrams)} g · ${b.diameterActual != null ? b.diameterActual.toFixed(2) : b.diameterTarget.toFixed(2)} mm · ${b.quality} quality`,
          timeLabel: timeAgo(b.producedAt),
          tone: { bg: theme.surface3, color: theme.text2 },
          glyph: 'batch' as const,
        }))
    }
    return alerts
      .filter((a: MachineAlert) =>
        q === '' ? true : a.title.toLowerCase().includes(q) || a.message.toLowerCase().includes(q),
      )
      .map((a: MachineAlert) => ({
        id: `a-${a.id}`,
        date: a.date,
        kind: 'alerts' as const,
        title: a.title,
        sub: a.message,
        timeLabel: timeAgo(a.date),
        tone:
          a.severity === 'error'
            ? { bg: theme.dangerBg, color: theme.danger }
            : a.severity === 'warning'
              ? { bg: theme.warningBg, color: theme.warning }
              : a.severity === 'success'
                ? { bg: theme.successBg, color: theme.success }
                : { bg: theme.infoBg, color: theme.info },
        glyph:
          a.severity === 'error'
            ? ('alertError' as const)
            : a.severity === 'warning'
              ? ('alertWarn' as const)
              : a.severity === 'success'
                ? ('alertOk' as const)
                : ('alertInfo' as const),
      }))
  }, [tab, query, statusFilter, sessions, batches, alerts, theme])

  // Group by day for SectionList
  const sections = useMemo(() => {
    const map = new Map<string, TimelineItem[]>()
    for (const it of items) {
      const key = dayLabel(it.date)
      const arr = map.get(key) ?? []
      arr.push(it)
      map.set(key, arr)
    }
    return [...map.entries()].map(([title, data]) => ({ title, data }))
  }, [items])

  async function exportCsv() {
    let csv = ''
    let name = ''
    if (tab === 'sessions') {
      csv = toCsv([
        ['Session', 'Started', 'PET input (g)', 'Filament output (g)', 'Duration (min)', 'Status', 'Notes'],
        ...sessions.map((s) => [
          s.id,
          s.startedAt,
          s.materialInput ?? '',
          s.materialOutput ?? '',
          s.durationMinutes != null ? Math.round(s.durationMinutes) : '',
          s.status,
          s.notes ?? '',
        ]),
      ])
      name = '3awedlou-sessions.csv'
    } else if (tab === 'filament') {
      csv = toCsv([
        ['Batch', 'Produced', 'Color', 'Diameter target (mm)', 'Diameter actual (mm)', 'Weight (g)', 'Quality'],
        ...batches.map((b) => [
          b.batchCode,
          b.producedAt,
          b.color,
          b.diameterTarget,
          b.diameterActual ?? '',
          Math.round(b.weightGrams),
          b.quality,
        ]),
      ])
      name = '3awedlou-batches.csv'
    } else {
      csv = toCsv([
        ['Severity', 'Title', 'Message', 'Date', 'Read'],
        ...alerts.map((a) => [a.severity, a.title, a.message, a.date, a.read ? 'yes' : 'no']),
      ])
      name = '3awedlou-alerts.csv'
    }

    try {
      // Write the CSV to a temp cache file, then open the native share sheet.
      const file = new File(Paths.cache, name)
      file.write(csv)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export history report',
        })
        setExportMsg('Report shared')
      } else {
        setExportMsg('Sharing not available on this device')
      }
    } catch {
      setExportMsg('Export failed')
    }
    setTimeout(() => setExportMsg(null), 2200)
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ChevronHeader title="History" onBack={() => navigation.goBack()} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.lg, flex: 1 }}>
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: theme.text3 }}>
            HISTORY
          </Text>
          <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: theme.text }}>
            Everything your machine did.
          </Text>
        </View>

        <SearchInput
          placeholder={tab === 'sessions' ? 'Search session id or note…' : 'Search…'}
          value={query}
          onChangeText={setQuery}
        />

        <Segmented
          options={[
            { value: 'sessions', label: 'Sessions' },
            { value: 'filament', label: 'Filament' },
            { value: 'alerts', label: 'Alerts' },
          ]}
          value={tab}
          onChange={(v) => setTab(v)}
        />

        {tab === 'sessions' && (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip active={statusFilter === 'all'} onPress={() => setStatusFilter('all')}>All</Chip>
            <Chip active={statusFilter === 'completed'} onPress={() => setStatusFilter('completed')}>Completed</Chip>
            <Chip active={statusFilter === 'failed'} onPress={() => setStatusFilter('failed')}>Failed</Chip>
          </View>
        )}

        {sections.length === 0 ? (
          <Card>
            <StateBlock
              kind="empty"
              title="Nothing recorded"
              text="No entries match your filters. Sessions and batches appear as the machine runs."
            />
          </Card>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={(it) => it.id}
            contentContainerStyle={{ paddingBottom: spacing.xl, flexGrow: 1 }}
            stickySectionHeadersEnabled={false}
            renderItem={({ item, index, section }) => (
              <View
                style={[
                  styles.tlItem,
                  index === section.data.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={styles.tlRail}>
                  <View style={[styles.tlNode, { backgroundColor: item.tone.bg }]}>
                    <TimelineGlyph item={item} />
                  </View>
                  {index < section.data.length - 1 && (
                    <View style={{ width: 2, flex: 1, backgroundColor: theme.border, marginTop: 4 }} />
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0, alignSelf: 'center' }}>
                  <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '700', color: theme.text }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: theme.text2, lineHeight: 17 }}>{item.sub}</Text>
                </View>
                <View style={{ alignSelf: 'center' }}>
                  {item.badge ? (
                    <Badge tone={item.badge.tone}>{item.badge.label}</Badge>
                  ) : (
                    item.timeLabel && (
                      <Text style={{ fontSize: 11, color: theme.text3, fontWeight: '600' }}>
                        {item.timeLabel}
                      </Text>
                    )
                  )}
                </View>
              </View>
            )}
            renderSectionHeader={({ section }) => (
              <View style={styles.tlDay}>
                <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: theme.text3 }}>
                  {section.title.toUpperCase()}
                </Text>
              </View>
            )}
          />
        )}

        {exportMsg ? (
          <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: theme.accentStrong }}>
            {exportMsg}
          </Text>
        ) : (
          <AppButton variant="secondary" block onPress={exportCsv}>
            <ButtonContent icon={<DownloadIcon size={16} color={theme.text} />} label="Export history report" color={theme.text} />
          </AppButton>
        )}
        <View style={{ height: insets.bottom }} />
      </View>
    </View>
  )
}

function TimelineGlyph({ item }: { item: TimelineItem }) {
  switch (item.glyph) {
    case 'session':
      return <RecycleIcon size={16} color={item.tone.color} />
    case 'batch':
      return <SpoolerIcon size={16} color={item.tone.color} />
    case 'alertError':
      return <AlertOctagonIcon size={16} color={item.tone.color} />
    case 'alertWarn':
      return <WrenchIcon size={16} color={item.tone.color} />
    default:
      return <WrenchIcon size={16} color={item.tone.color} />
  }
}

const styles = StyleSheet.create({
  tlDay: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    backgroundColor: 'transparent',
  },
  tlItem: {
    flexDirection: 'row',
    gap: 11,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  tlRail: {
    alignItems: 'center',
    width: 34,
  },
  tlNode: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

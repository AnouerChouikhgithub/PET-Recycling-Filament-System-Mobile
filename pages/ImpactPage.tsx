import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { machinesApi } from '../api'
import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { formatNumber } from '../lib/format'
import { spacing, radius } from '../theme/tokens'
import { BarChart, Donut } from '../components/charts'
import { Badge, Card, CardHead, Chip, StateBlock } from '../components/ui'
import { BottleIcon, InfoIcon, LeafIcon, RecycleIcon, SpoolerIcon } from '../components/icons'
import type { RecyclingRecord } from '../data/api'

type Range = '6mo' | 'all'

const BOTTLES_PER_KG = 25
const CO2_PER_KG_PET = 0.45

/** Group recycling records by month (measured input mass). */
function buildMonthly(records: RecyclingRecord[]): { month: string; petKg: number | null; filamentKg: number | null }[] {
  const byMonth = new Map<string, { petKg: number | null; filamentKg: number | null }>()
  for (const r of records) {
    const d = new Date(r.recycledAt)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const prev = byMonth.get(key) ?? { petKg: null as number | null, filamentKg: null as number | null }
    byMonth.set(key, {
      petKg: r.inputMassGrams == null ? prev.petKg : (prev.petKg ?? 0) + r.inputMassGrams / 1000,
      filamentKg: r.outputMassGrams == null ? prev.filamentKg : (prev.filamentKg ?? 0) + r.outputMassGrams / 1000,
    })
  }
  return Array.from(byMonth.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      month: new Date(`${key}-01T00:00:00`).toLocaleString('en-US', { month: 'short' }),
      petKg: v.petKg == null ? null : Math.round(v.petKg * 10) / 10,
      filamentKg: v.filamentKg == null ? null : Math.round(v.filamentKg * 10) / 10,
    }))
}

export function ImpactPage() {
  const { theme } = useTheme()
  const { selectedId, recyclingTotals } = useMachine()
  const insets = useSafeAreaInsets()
  const [range, setRange] = useState<Range>('6mo')
  const [metric, setMetric] = useState<'pet' | 'filament'>('pet')
  const [records, setRecords] = useState<RecyclingRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadRequest = useRef(0)

  const loadRecords = useCallback(async () => {
    if (!selectedId) return
    const request = ++loadRequest.current
    setError(null)
    try {
      const response = await machinesApi.recycling(selectedId, { limit: 200 })
      if (request === loadRequest.current) setRecords(response.records)
    } catch (err) {
      if (request === loadRequest.current) setError((err as Error).message)
    }
  }, [selectedId])

  useEffect(() => {
    void loadRecords()
    return () => {
      loadRequest.current += 1
    }
  }, [loadRecords])

  if (error && records === null) {
    return (
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.xl }}>
        <Card>
          <StateBlock kind="offline" title="Backend unreachable" text={error ?? ''} action="Refresh" onAction={() => void loadRecords()} />
        </Card>
      </ScrollView>
    )
  }

  const list = records ?? []
  const monthly = buildMonthly(list)
  const data = range === '6mo' ? monthly.slice(-6) : monthly

  // Measured values…
  const totalPetKg = recyclingTotals.inputGrams == null ? null : recyclingTotals.inputGrams / 1000
  const totalFilamentKg = recyclingTotals.outputGrams == null ? null : recyclingTotals.outputGrams / 1000
  // …and clearly-labelled estimates (documented conversion factors).
  const bottlesEquivalent = totalPetKg == null ? null : Math.round(totalPetKg * BOTTLES_PER_KG)
  const co2AvoidedKg = totalPetKg == null ? null : Math.round(totalPetKg * CO2_PER_KG_PET * 10) / 10

  const goalKg = 60
  const pct = totalPetKg == null ? null : Math.min(1, totalPetKg / goalKg)

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
          YOUR ENVIRONMENTAL IMPACT
        </Text>
        <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -0.5, color: theme.text, lineHeight: 30 }}>
          Real change, one bottle at a time.
        </Text>
        <Text style={{ fontSize: 13, color: theme.text2 }}>Measured recycling totals · estimates clearly labelled.</Text>
      </View>

      {/* Measured: total PET diverted */}
      <Card style={styles.donutWrap}>
        <Donut pct={pct ?? 0} size={172} thickness={15}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: theme.text, letterSpacing: -0.5 }}>
            {totalPetKg == null ? 'Not reported' : `${totalPetKg.toFixed(1)} kg`}
          </Text>
          <Text style={{ fontSize: 10.5, fontWeight: '700', color: theme.text3, letterSpacing: 0.7, marginTop: 2 }}>
            PET DIVERTED
          </Text>
          <View style={{ marginTop: 7 }}>
            <Badge tone="success" dot>
              Measured
            </Badge>
          </View>
        </Donut>
        <Text style={{ fontSize: 12.5, color: theme.text2, textAlign: 'center', lineHeight: 18, maxWidth: 280 }}>
          {pct == null ? 'PET input mass has not been reported.' : `${Math.round(pct * 100)}% of this year's goal (${goalKg} kg). Measured directly from ${recyclingTotals.records} recycling records — no estimates here.`}
        </Text>
      </Card>

      {/* Estimated outputs */}
      <Card style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: theme.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <BottleIcon size={18} color={theme.accentStrong} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.text }}>
              {bottlesEquivalent == null ? 'Not reported' : `≈ ${formatNumber(bottlesEquivalent)}`}
            </Text>
            <Text style={{ fontSize: 11, color: theme.text2, fontWeight: '600' }}>
              bottles diverted (estimated)
            </Text>
          </View>
          <Badge tone="neutral">Estimate</Badge>
        </View>
      </Card>

      <View style={styles.tileRow}>
        <Tile icon={<LeafIcon size={17} color={theme.info} />} iconBg={theme.infoBg} value={co2AvoidedKg == null ? 'Not reported' : `≈ ${co2AvoidedKg} kg`} label="CO₂e avoided" />
        <Tile icon={<SpoolerIcon size={17} color={theme.accentStrong} />} iconBg={theme.accentSoft} value={totalFilamentKg == null ? 'Not reported' : `${totalFilamentKg.toFixed(1)} kg`} label="filament made" />
        <Tile icon={<RecycleIcon size={17} color={theme.accentStrong} />} iconBg={theme.accentSoft} value={String(list.length)} label="records" />
      </View>

      {/* Activity over time */}
      <Card>
        <CardHead
          icon={<RecycleIcon size={15} color={theme.text3} />}
          title="Recycled over time"
          action={
            <Badge tone="success" dot>
              Measured
            </Badge>
          }
        />
        <View style={{ padding: spacing.lg, paddingTop: 10, gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Chip active={metric === 'pet'} onPress={() => setMetric('pet')}>PET</Chip>
            <Chip active={metric === 'filament'} onPress={() => setMetric('filament')}>Filament</Chip>
            <View style={{ flex: 1 }} />
            <Chip active={range === '6mo'} onPress={() => setRange('6mo')}>6 mo</Chip>
            <Chip active={range === 'all'} onPress={() => setRange('all')}>All</Chip>
          </View>
          {data.length === 0 || data.every((d) => (metric === 'pet' ? d.petKg : d.filamentKg) == null) ? (
            <Text style={{ fontSize: 13, color: theme.text2, textAlign: 'center', paddingVertical: 18 }}>
              {data.length === 0 ? 'No recycling records yet — the chart fills in as sessions complete.' : 'No measured mass has been reported for this metric yet.'}
            </Text>
          ) : (
            <BarChart
              data={data
                .filter((d) => (metric === 'pet' ? d.petKg : d.filamentKg) != null)
                .map((d) => ({
                  label: d.month,
                  value: metric === 'pet' ? d.petKg! : d.filamentKg!,
                }))}
              formatValue={(v) => v.toFixed(1)}
            />
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, color: theme.text2, fontWeight: '600' }}>
              Total shown:{' '}
              <Text style={{ color: theme.text, fontWeight: '800' }}>
                {data.some((d) => (metric === 'pet' ? d.petKg : d.filamentKg) != null) ? `${data.reduce((a, d) => a + (metric === 'pet' ? (d.petKg ?? 0) : (d.filamentKg ?? 0)), 0).toFixed(1)} kg` : 'Not reported'}
              </Text>
            </Text>
          </View>
        </View>
      </Card>

      {/* Methodology */}
      <Card style={{ padding: spacing.lg }}>
        <CardHead icon={<InfoIcon size={15} color={theme.text3} />} title="About these numbers" />
        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginTop: 10,
            backgroundColor: theme.surface2,
            borderRadius: radius.md,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            padding: spacing.md,
          }}
        >
          <InfoIcon size={16} color={theme.text3} />
          <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: theme.text2 }}>
            Weights are recorded in the backend when reported; missing values remain unreported. Bottle counts and CO₂e are{' '}
            <Text style={{ fontWeight: '800', color: theme.text }}>estimates</Text> based on ~40 g
            average bottle weight and ~{CO2_PER_KG_PET} kg CO₂e per kg of PET (public lifecycle
            estimates).
          </Text>
        </View>
      </Card>
    </ScrollView>
  )
}

function Tile({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: React.ReactNode
  iconBg: string
  value: string
  label: string
}) {
  const { theme } = useTheme()
  return (
    <Card style={{ flex: 1, padding: spacing.md, gap: 7, minWidth: 0 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: iconBg, alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </View>
      <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
        {value}
      </Text>
      <Text numberOfLines={1} style={{ fontSize: 11, color: theme.text2, fontWeight: '600' }}>
        {label}
      </Text>
    </Card>
  )
}

const styles = StyleSheet.create({
  donutWrap: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
})

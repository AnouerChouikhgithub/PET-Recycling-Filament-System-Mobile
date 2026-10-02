import { useEffect, useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'

import { machinesApi } from '../api'
import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { formatDateTime, timeAgo } from '../lib/format'
import { radius, spacing } from '../theme/tokens'
import {
  AppButton,
  Badge,
  Card,
  ChevronHeader,
  Chip,
  SearchInput,
  Sheet,
  StateBlock,
} from '../components/ui'
import { SpoolerIcon, ThermometerIcon } from '../components/icons'
import type { FilamentProduction, FilamentQuality } from '../data/api'

type QualityFilter = 'all' | FilamentQuality

const QUALITY_TONE: Record<FilamentQuality, 'success' | 'accent' | 'warning' | 'danger'> = {
  excellent: 'success',
  good: 'accent',
  fair: 'warning',
  poor: 'danger',
}

export function FilamentPage() {
  const { theme } = useTheme()
  const { selectedId } = useMachine()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation()
  const [query, setQuery] = useState('')
  const [quality, setQuality] = useState<QualityFilter>('all')
  const [selected, setSelected] = useState<FilamentProduction | null>(null)
  const [batches, setBatches] = useState<FilamentProduction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId) return
    let cancelled = false
    setLoading(true)
    machinesApi
      .production(selectedId, { limit: 100 })
      .then((rows) => {
        if (!cancelled) setBatches(rows)
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return batches
      .filter((b) => {
        const okQ =
          q === '' ||
          b.batchCode.toLowerCase().includes(q) ||
          b.color.toLowerCase().includes(q) ||
          (b.notes ?? '').toLowerCase().includes(q)
        const okF = quality === 'all' || b.quality === quality
        return okQ && okF
      })
      .sort((a, b) => b.producedAt.localeCompare(a.producedAt))
  }, [batches, query, quality])

  const totalWeightG = batches.reduce((a, b) => a + b.weightGrams, 0)

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ChevronHeader title="Filament library" onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: theme.text3 }}>
            FILAMENT LIBRARY
          </Text>
          <Text style={{ fontSize: 25, fontWeight: '800', letterSpacing: -0.5, color: theme.text, lineHeight: 30 }}>
            {batches.length} batches on the shelf.
          </Text>
          <Text style={{ fontSize: 13, color: theme.text2 }}>
            {(totalWeightG / 1000).toFixed(1)} kg of rPET filament produced from recycled bottles.
          </Text>
        </View>

        <SearchInput
          placeholder="Search batch, color or note…"
          value={query}
          onChangeText={setQuery}
        />

        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {(['all', 'excellent', 'good', 'fair', 'poor'] as const).map((q) => (
            <Chip key={q} active={quality === q} onPress={() => setQuality(q)}>
              {q === 'all' ? 'All' : `${q[0].toUpperCase()}${q.slice(1)}`}
            </Chip>
          ))}
        </View>

        {loading ? (
          <Card>
            <StateBlock kind="offline" title="Loading batches…" text="Fetching production records from the backend." />
          </Card>
        ) : error ? (
          <Card>
            <StateBlock kind="offline" title="Backend unreachable" text={error} action="Refresh" onAction={() => setError(null)} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <StateBlock
              kind="empty"
              title={batches.length === 0 ? 'No batches yet' : 'No batches found'}
              text={batches.length === 0 ? 'Batches appear as the machine produces filament.' : 'Try a different search term or clear the quality filter.'}
            />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map((b) => (
              <BatchCard key={b.id} batch={b} onClick={() => setSelected(b)} />
            ))}
          </View>
        )}

        <BatchDetailSheet batch={selected} onClose={() => setSelected(null)} />
      </ScrollView>
    </View>
  )
}

function BatchCard({ batch: b, onClick }: { batch: FilamentProduction; onClick: () => void }) {
  const { theme } = useTheme()
  return (
    <Card onPress={onClick} style={{ padding: spacing.lg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            backgroundColor: theme.surface2,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: theme.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <View style={{ width: 18, height: 18, borderRadius: 5, backgroundColor: b.colorHex }} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>{b.batchCode}</Text>
            <Badge tone={QUALITY_TONE[b.quality]}>{b.quality}</Badge>
          </View>
          <Text numberOfLines={1} style={{ fontSize: 12, color: theme.text2, marginTop: 2 }}>
            {b.color} · {b.diameterActual != null ? `${b.diameterActual.toFixed(2)} mm` : `${b.diameterTarget.toFixed(2)} mm target`} · {timeAgo(b.producedAt)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>{Math.round(b.weightGrams)} g</Text>
          {b.lengthMeters != null && (
            <Text style={{ fontSize: 11, color: theme.text3, fontWeight: '600' }}>{Math.round(b.lengthMeters)} m</Text>
          )}
        </View>
      </View>
    </Card>
  )
}

function BatchDetailSheet({ batch, onClose }: { batch: FilamentProduction | null; onClose: () => void }) {
  const { theme } = useTheme()
  const [exported, setExported] = useState(false)
  if (!batch) return null
  const b = batch

  return (
    <Sheet
      open={!!batch}
      onClose={onClose}
      title={`${b.batchCode} · ${b.color}`}
      subtitle={formatDateTime(b.producedAt)}
      actions={
        <AppButton
          variant="secondary"
          block
          onPress={() => {
            setExported(true)
            setTimeout(() => setExported(false), 2200)
          }}
        >
          {exported ? 'Spec sheet saved' : 'Export spec sheet'}
        </AppButton>
      }
    >
      {/* Spool preview */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.lg,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: theme.surface2,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            backgroundColor: b.colorHex,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <SpoolerIcon size={26} color="rgba(255,255,255,0.9)" />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: theme.text }}>
            {b.material} filament
          </Text>
          <Text style={{ fontSize: 12, color: theme.text2 }}>
            Wound on spool · {Math.round(b.weightGrams)} g
            {b.lengthMeters != null ? ` · ${Math.round(b.lengthMeters)} m` : ''}
          </Text>
          <Badge tone={QUALITY_TONE[b.quality]}>{b.quality} quality</Badge>
        </View>
      </View>

      {/* Specs */}
      <Card style={{ padding: spacing.lg }}>
        <SpecRow k="Material" v={b.material} />
        <SpecRow k="Diameter target" v={`${b.diameterTarget.toFixed(2)} mm`} />
        <SpecRow k="Diameter actual" v={b.diameterActual != null ? `${b.diameterActual.toFixed(2)} mm` : '—'} />
        <SpecRow k="Weight" v={`${Math.round(b.weightGrams)} g`} />
        {b.lengthMeters != null && <SpecRow k="Length" v={`${Math.round(b.lengthMeters)} m`} />}
        <SpecRow k="Produced" v={formatDateTime(b.producedAt)} />
      </Card>

      {/* Notes */}
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
        <ThermometerIcon size={16} color={theme.text3} />
        <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: theme.text2 }}>
          {b.notes ?? 'No quality notes recorded for this batch.'}
        </Text>
      </View>
    </Sheet>
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

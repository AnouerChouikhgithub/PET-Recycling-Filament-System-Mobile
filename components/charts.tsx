import { View, Text, StyleSheet } from 'react-native'
import { Circle, Path, Polyline, Svg } from 'react-native-svg'

import { useTheme } from '../contexts/ThemeContext'
import { radius } from '../theme/tokens'

/* ============ Semicircular gauge (Home quick stats) ============ */

export function Gauge({
  value,
  min,
  max,
  label,
  unit,
  decimals = 0,
  status = 'nominal',
  target,
}: {
  value: number
  min: number
  max: number
  label: string
  unit: string
  decimals?: number
  status?: 'nominal' | 'warning' | 'error'
  target?: number
}) {
  const { theme } = useTheme()
  const pct = clamp01((value - min) / (max - min || 1))
  const stroke =
    status === 'error' ? theme.danger : status === 'warning' ? theme.warning : theme.green500
  const r = 30
  const arc = Math.PI * r

  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 3,
            backgroundColor:
              status === 'error' ? theme.danger : status === 'warning' ? theme.warning : theme.green500,
          }}
        />
        <Text numberOfLines={1} style={{ fontSize: 10.5, fontWeight: '700', color: theme.text2 }}>
          {label}
        </Text>
      </View>
      <View style={{ position: 'relative', width: 84, height: 52 }}>
        <Svg width={84} height={52} viewBox="0 0 84 52">
          <Path
            d={`M 12 46 A ${r} ${r} 0 0 1 72 46`}
            fill="none"
            stroke={theme.surface3}
            strokeWidth={9}
            strokeLinecap="round"
          />
          <Path
            d={`M 12 46 A ${r} ${r} 0 0 1 72 46`}
            fill="none"
            stroke={stroke}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${arc * pct} ${arc}`}
          />
        </Svg>
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          pointerEvents="none"
        >
          <Text style={{ fontSize: 17, fontWeight: '800', color: theme.text, letterSpacing: -0.3 }}>
            {value.toFixed(decimals)}
          </Text>
          <Text style={{ fontSize: 8.5, fontWeight: '700', color: theme.text3, letterSpacing: 0.6 }}>
            {unit.toUpperCase()}
          </Text>
        </View>
      </View>
      {target !== undefined && (
        <Text style={{ fontSize: 10, color: theme.text3, fontWeight: '600' }}>
          Tgt {target}
          {unit}
        </Text>
      )}
    </View>
  )
}

/* ============ Sparkline ============ */

export function Sparkline({
  data,
  width = 64,
  height = 26,
  status = 'nominal',
}: {
  data: number[]
  width?: number
  height?: number
  status?: 'nominal' | 'warning' | 'error'
}) {
  const { theme } = useTheme()
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const step = width / (data.length - 1)
  const pts = data.map(
    (v, i) => `${(i * step).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`,
  )
  const stroke =
    status === 'error' ? theme.danger : status === 'warning' ? theme.warning : theme.spark
  const last = pts[pts.length - 1].split(',')

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline
        points={pts.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={last[0]} cy={last[1]} r={2.2} fill={stroke} />
    </Svg>
  )
}

/* ============ Donut (Impact) ============ */

export function Donut({
  pct,
  size = 172,
  thickness = 15,
  children,
}: {
  pct: number
  size?: number
  thickness?: number
  children?: React.ReactNode
}) {
  const { theme } = useTheme()
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const clamped = clamp01(pct)

  return (
    <View style={{ position: 'relative', width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.surface3}
          strokeWidth={thickness}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={theme.green500}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={`${c * clamped} ${c}`}
        />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  )
}

/* ============ Bar chart (Impact) ============ */

export function BarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number }[]
  formatValue?: (v: number) => string
}) {
  const { theme } = useTheme()
  const max = Math.max(...data.map((d) => d.value), 0.001)

  return (
    <View style={styles.barchart}>
      {data.map((d) => (
        <View key={d.label} style={styles.barCol}>
          <Text style={{ fontSize: 9.5, fontWeight: '800', color: theme.text2 }}>
            {formatValue ? formatValue(d.value) : d.value}
          </Text>
          <View style={styles.barSlot}>
            <View
              style={{
                width: '100%',
                maxHeight: 34,
                borderRadius: 6,
                backgroundColor: theme.chartBar,
                height: `${Math.max(5, (d.value / max) * 100)}%`,
              }}
            />
          </View>
          <Text style={{ fontSize: 10, fontWeight: '700', color: theme.text3 }}>{d.label}</Text>
        </View>
      ))}
    </View>
  )
}

/* ============ Thin progress bar ============ */

export function ProgressBar({ pct }: { pct: number }) {
  const { theme } = useTheme()
  return (
    <View
      style={{
        height: 12,
        borderRadius: radius.full,
        backgroundColor: theme.surface3,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          height: '100%',
          borderRadius: radius.full,
          backgroundColor: theme.dark ? theme.green600 : theme.green500,
          width: `${clamp01(pct) * 100}%`,
        }}
      />
    </View>
  )
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0))
}

const styles = StyleSheet.create({
  barchart: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    gap: 7,
    height: 150,
    paddingTop: 18,
  },
  barCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 6,
  },
  barSlot: {
    flex: 1,
    width: '100%',
    maxWidth: 34,
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
})

import { useRef } from 'react'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useTheme } from '../contexts/ThemeContext'
import { radius, spacing, type as t } from '../theme/tokens'
import type { AlertSeverity, SessionStatus } from '../data/types'
import { useToast } from '../contexts/ToastContext'
import {
  AlertOctagonIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  InfoIcon,
  RefreshIcon,
  SearchIcon,
  WarningIcon,
  XIcon,
} from './icons'

/* ================= Button ================= */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function AppButton({
  variant = 'primary',
  size = 'md',
  block,
  loading,
  onPress,
  disabled,
  style,
  children,
}: {
  variant?: Variant
  size?: 'md' | 'sm'
  block?: boolean
  loading?: boolean
  onPress?: () => void
  disabled?: boolean
  style?: ViewStyle
  children?: ReactNode
}) {
  const { theme } = useTheme()
  const off = disabled || loading

  const bg =
    variant === 'primary'
      ? theme.accent
      : variant === 'secondary'
        ? theme.surface
        : variant === 'danger'
          ? theme.dangerBg
          : variant === 'success'
            ? theme.successBg
            : 'transparent'

  const fg =
    variant === 'primary'
      ? theme.accentContrast
      : variant === 'secondary'
        ? theme.text
        : variant === 'danger'
          ? theme.danger
          : variant === 'success'
            ? theme.success
            : theme.text2

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      hitSlop={4}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          opacity: off ? 0.45 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth * 1.5 : 0,
          borderColor: theme.borderStrong,
        },
        styles.btn,
        size === 'sm' && styles.btnSm,
        block && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={fg} style={{ marginRight: 7 }} />}
      {typeof children === 'string' ? (
        <Text style={{ color: fg, fontSize: size === 'sm' ? 13 : 14.5, fontWeight: '700' }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

/** Row layout for button content with icon + label. */
export function ButtonContent({
  icon,
  label,
  color,
  size = 'md',
}: {
  icon?: ReactNode
  label: string
  color: string
  size?: 'md' | 'sm'
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
      {icon}
      <Text style={{ color, fontSize: size === 'sm' ? 13 : 14.5, fontWeight: '700' }}>{label}</Text>
    </View>
  )
}

/* ================= Card ================= */

export function Card({
  children,
  style,
  onPress,
}: {
  children: ReactNode
  style?: ViewStyle
  onPress?: () => void
}) {
  const { theme } = useTheme()
  const base: ViewStyle = {
    backgroundColor: theme.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  }
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, { opacity: pressed ? 0.9 : 1 }, style]}>
        {children}
      </Pressable>
    )
  }
  return <View style={[base, style]}>{children}</View>
}

export function CardHead({
  icon,
  title,
  action,
}: {
  icon?: ReactNode
  title: string
  action?: ReactNode
}) {
  const { theme } = useTheme()
  return (
    <View style={styles.cardHead}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, flex: 1, minWidth: 0 }}>
        {icon}
        <Text numberOfLines={1} style={{ ...t.head, color: theme.text, flexShrink: 1 }}>
          {title}
        </Text>
      </View>
      {action}
    </View>
  )
}

/* ================= Badge ================= */

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral'

export function Badge({
  tone,
  children,
  dot,
}: {
  tone: BadgeTone
  children: ReactNode
  dot?: boolean
}) {
  const { theme } = useTheme()
  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    success: { bg: theme.successBg, fg: theme.success },
    warning: { bg: theme.warningBg, fg: theme.warning },
    danger: { bg: theme.dangerBg, fg: theme.danger },
    info: { bg: theme.infoBg, fg: theme.info },
    accent: { bg: theme.accentSoft, fg: theme.accentStrong },
    neutral: { bg: theme.surface3, fg: theme.text2 },
  }
  const { bg, fg } = map[tone]
  return (
    <View
      style={{
        backgroundColor: bg,
        borderRadius: radius.full,
        paddingHorizontal: 9,
        paddingVertical: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        alignSelf: 'flex-start',
      }}
    >
      {dot && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />}
      <Text style={{ color: fg, fontSize: 11.5, fontWeight: '700' }}>{children}</Text>
    </View>
  )
}

export const SESSION_BADGE: Record<SessionStatus, { tone: BadgeTone; label: string }> = {
  in_progress: { tone: 'accent', label: 'In progress' },
  paused: { tone: 'warning', label: 'Paused' },
  completed: { tone: 'success', label: 'Completed' },
  failed: { tone: 'danger', label: 'Failed' },
}

/* ================= Chips / segmented ================= */

export function Chip({
  active,
  onPress,
  children,
}: {
  active?: boolean
  onPress?: () => void
  children: ReactNode
}) {
  const { theme } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      hitSlop={2}
      style={({ pressed }) => ({
        opacity: pressed ? 0.8 : 1,
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radius.full,
        borderWidth: StyleSheet.hairlineWidth * 1.5,
        borderColor: active ? theme.accent : theme.borderStrong,
        backgroundColor: active ? theme.accent : theme.surface,
      })}
    >
      <Text
        style={{
          color: active ? theme.accentContrast : theme.text2,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {children}
      </Text>
    </Pressable>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  const { theme } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 4,
        padding: 4,
        backgroundColor: theme.surfaceInset,
        borderRadius: radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.border,
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 8,
              borderRadius: radius.sm,
              backgroundColor: active ? theme.surface : 'transparent',
              opacity: pressed ? 0.8 : 1,
              alignItems: 'center',
            })}
          >
            <Text
              numberOfLines={1}
              style={{ color: active ? theme.text : theme.text2, fontSize: 12.5, fontWeight: '700' }}
            >
              {o.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

/* ================= Inputs ================= */

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  const { theme } = useTheme()
  return (
    <View>
      <Text style={{ ...t.micro, color: theme.text2, marginBottom: 7, letterSpacing: 0.3 }}>
        {label.toUpperCase()}
      </Text>
      {children}
      {hint && (
        <Text style={{ ...t.sub, color: theme.text2, marginTop: 6 }}>{hint}</Text>
      )}
    </View>
  )
}

export function AppTextInput({
  suffix,
  style,
  ...rest
}: React.ComponentProps<typeof TextInput> & { suffix?: string }) {
  const { theme } = useTheme()
  const input = (
    <TextInput
      placeholderTextColor={theme.text3}
      style={[
        {
          backgroundColor: theme.surface,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth * 1.5,
          borderColor: theme.borderStrong,
          color: theme.text,
          fontSize: 15,
          fontWeight: '600',
          paddingHorizontal: spacing.lg,
          paddingVertical: 13,
        },
        suffix ? { paddingRight: 44 } : null,
        style,
      ]}
      {...rest}
    />
  )
  if (!suffix) return input
  return (
    <View>
      {input}
      <View pointerEvents="none" style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
        <Text style={{ color: theme.text3, fontSize: 12.5, fontWeight: '700' }}>{suffix}</Text>
      </View>
    </View>
  )
}

export function SearchInput(props: React.ComponentProps<typeof TextInput>) {
  const { theme } = useTheme()
  return (
    <View>
      <TextInput
        placeholderTextColor={theme.text3}
        style={[
          {
            backgroundColor: theme.surfaceInset,
            borderRadius: radius.full,
            color: theme.text,
            fontSize: 13.5,
            fontWeight: '600',
            paddingLeft: 40,
            paddingRight: spacing.lg,
            paddingVertical: 11,
          },
          props.style,
        ]}
        {...props}
      />
      <View pointerEvents="none" style={{ position: 'absolute', left: 13, top: 0, bottom: 0, justifyContent: 'center' }}>
        <SearchIcon size={16} color={theme.text3} />
      </View>
    </View>
  )
}

/* ================= Toggle ================= */

export function Toggle({
  on,
  onChange,
  label,
}: {
  on: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  const { theme } = useTheme()
  const pos = useRef(new Animated.Value(on ? 1 : 0)).current

  useEffect(() => {
    Animated.spring(pos, {
      toValue: on ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 60,
    }).start()
  }, [on, pos])

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={label}
      onPress={() => onChange(!on)}
      hitSlop={6}
      style={{
        width: 48,
        height: 29,
        borderRadius: radius.full,
        backgroundColor: on ? theme.accent : theme.surface3,
        justifyContent: 'center',
        paddingHorizontal: 3,
      }}
    >
      <Animated.View
        style={{
          width: 23,
          height: 23,
          borderRadius: 12,
          backgroundColor: '#ffffff',
          transform: [
            {
              translateX: pos.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 19],
              }),
            },
          ],
        }}
      />
    </Pressable>
  )
}

/* ================= Bottom sheet (Modal) ================= */

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  actions?: ReactNode
}) {
  const { theme } = useTheme()
  const slide = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (open) {
      slide.setValue(0)
      Animated.timing(slide, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }
  }, [open, slide])

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(8,12,10,0.55)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable onPress={() => {}}>
          <Animated.View
            style={{
              backgroundColor: theme.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              maxHeight: '86%',
              transform: [
                {
                  translateY: slide.interpolate({
                    inputRange: [0, 1],
                    outputRange: [400, 0],
                  }),
                },
              ],
            }}
          >
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: theme.borderStrong,
                alignSelf: 'center',
                marginTop: 10,
              }}
            />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: spacing.xl,
                paddingTop: 8,
                paddingBottom: spacing.md,
              }}
            >
              <View style={{ flex: 1, marginRight: spacing.sm }}>
                <Text style={{ ...t.title, color: theme.text }}>{title}</Text>
                {subtitle && (
                  <Text style={{ ...t.sub, color: theme.text2, marginTop: 2 }}>{subtitle}</Text>
                )}
              </View>
              <IconBtn onPress={onClose} accessibilityLabel="Close">
                <XIcon size={18} color={theme.text2} />
              </IconBtn>
            </View>
            <ScrollView bounces={false} style={{ maxHeight: 460 }}>
              <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.lg }}>
                {children}
              </View>
            </ScrollView>
            {actions && (
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.xl,
                  paddingTop: spacing.md,
                  paddingBottom: spacing.xxl,
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                }}
              >
                {actions}
              </View>
            )}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/* ================= Stack-screen header (back + title) ================= */

export function ChevronHeader({
  title,
  onBack,
}: {
  title: string
  onBack: () => void
}) {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingTop: insets.top + 4,
        paddingBottom: 8,
        backgroundColor: theme.bg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.border,
      }}
    >
      <IconBtn onPress={onBack} accessibilityLabel="Go back">
        <ChevronLeftIcon size={20} color={theme.text} />
      </IconBtn>
      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.text, flex: 1 }} numberOfLines={1}>
        {title}
      </Text>
    </View>
  )
}

/* ================= Icon button ================= */

export function IconBtn({
  onPress,
  accessibilityLabel,
  children,
  style,
}: {
  onPress?: () => void
  accessibilityLabel: string
  children: ReactNode
  style?: ViewStyle
}) {
  const { theme } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: 40,
          height: 40,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.border,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {children}
    </Pressable>
  )
}

/* ================= States ================= */

export function StateBlock({
  kind,
  title,
  text,
  action,
  onAction,
}: {
  kind: 'empty' | 'error' | 'offline' | 'loading'
  title: string
  text: string
  action?: string
  onAction?: () => void
}) {
  const { theme } = useTheme()
  const map = {
    empty: { icon: <InfoIcon size={28} color={theme.text2} />, bg: theme.surface3, fg: theme.text2 },
    error: { icon: <AlertOctagonIcon size={28} color={theme.danger} />, bg: theme.dangerBg, fg: theme.danger },
    offline: { icon: <AlertOctagonIcon size={28} color={theme.danger} />, bg: theme.dangerBg, fg: theme.danger },
    loading: { icon: <RefreshIcon size={28} color={theme.accentStrong} />, bg: theme.accentSoft, fg: theme.accentStrong },
  }[kind]

  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: map.bg,
          marginBottom: 4,
        }}
      >
        {map.icon}
      </View>
      <Text style={{ ...t.title, color: theme.text, textAlign: 'center' }}>{title}</Text>
      <Text style={{ ...t.sub, color: theme.text2, textAlign: 'center', lineHeight: 18, maxWidth: 260 }}>
        {text}
      </Text>
      {action && (
        <AppButton onPress={onAction} style={{ marginTop: 8 }}>
          {action}
        </AppButton>
      )}
    </View>
  )
}

/* ================= Toasts ================= */

const TOAST_ICON: Record<AlertSeverity, (c: string) => ReactNode> = {
  success: (c) => <CheckCircleIcon size={20} color={c} />,
  info: (c) => <InfoIcon size={20} color={c} />,
  warning: (c) => <WarningIcon size={20} color={c} />,
  error: (c) => <AlertOctagonIcon size={20} color={c} />,
}

export function ToastHost() {
  const { toasts, dismiss } = useToast()
  const { theme } = useTheme()
  if (toasts.length === 0) return null
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: 60,
        left: spacing.lg,
        right: spacing.lg,
        zIndex: 100,
        gap: spacing.sm,
      }}
    >
      {toasts.map((toast) => {
        const fgColor =
          toast.severity === 'success'
            ? theme.success
            : toast.severity === 'warning'
              ? theme.warning
              : toast.severity === 'error'
                ? theme.danger
                : theme.info
        return (
          <Pressable
            key={toast.id}
            onPress={() => dismiss(toast.id)}
            style={{
              backgroundColor: theme.surface,
              borderRadius: radius.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              padding: spacing.md,
              flexDirection: 'row',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <View style={{ marginTop: 1 }}>{TOAST_ICON[toast.severity](fgColor)}</View>
            <View style={{ flex: 1 }}>
              <Text style={{ ...t.head, color: theme.text }}>{toast.title}</Text>
              {toast.message && (
                <Text style={{ ...t.sub, color: theme.text2, marginTop: 1, lineHeight: 16 }}>
                  {toast.message}
                </Text>
              )}
            </View>
          </Pressable>
        )
      })}
    </View>
  )
}

/* ================= Styles ================= */

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 46,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  btnSm: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
})

export type { TextStyle }

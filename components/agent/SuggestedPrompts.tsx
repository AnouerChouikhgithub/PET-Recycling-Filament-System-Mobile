import { Pressable, StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../contexts/ThemeContext'
import { radius, spacing, type as t } from '../../theme/tokens'
import { SparklesIcon } from '../icons'

/**
 * Prompts that map 1:1 to the five read-only tools the backend actually
 * exposes. They are suggestions, not promises: a prompt can legitimately come
 * back with "no data" — the app never implies the assistant controls the
 * machine (it cannot: there is no write tool).
 */
export const SUGGESTED_PROMPTS: string[] = [
  'Show my machines.',
  'What is the latest telemetry for my machine?',
  'Show recent machine events.',
  'Explain this fault code.',
  'Show recent audit activity for my machine.',
]

export function SuggestedPrompts({ onPick }: { onPick: (prompt: string) => void }) {
  const { theme } = useTheme()

  return (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
      <View
        style={[
          styles.intro,
          { backgroundColor: theme.accentSoft, borderColor: theme.accentBorder },
        ]}
      >
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 11,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.surface,
          }}
        >
          <SparklesIcon size={18} color={theme.accentStrong} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ ...t.head, color: theme.text }}>Ask about your machine</Text>
          <Text style={{ ...t.sub, color: theme.text2, lineHeight: 17, marginTop: 2 }}>
            The assistant reads your machines, telemetry, events and activity log through the backend.
            It cannot change temperatures, motors or any setting.
          </Text>
        </View>
      </View>

      <Text style={{ ...t.micro, color: theme.text3, letterSpacing: 0.4 }}>TRY ONE OF THESE</Text>

      <View style={{ gap: spacing.sm }}>
        {SUGGESTED_PROMPTS.map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => onPick(prompt)}
            accessibilityRole="button"
            accessibilityLabel={`Use suggested prompt: ${prompt}`}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderStrong,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <SparklesIcon size={14} color={theme.accentStrong} />
            <Text style={{ flex: 1, fontSize: 13, fontWeight: '600', color: theme.text }}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  intro: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md + 2,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
})

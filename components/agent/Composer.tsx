import { useMemo } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import { useTheme } from '../../contexts/ThemeContext'
import { AGENT_MESSAGE_MAX_CHARS } from '../../lib/agentContract'
import { radius, spacing, type as t } from '../../theme/tokens'
import { SendIcon } from '../icons'

interface ComposerProps {
  value: string
  onChangeText: (text: string) => void
  onSend: () => void
  /** A turn is in flight — the send action is locked while pending. */
  sending: boolean
  /** Rate limited or assistant disabled: the whole composer is inert. */
  locked: boolean
  /** Validation error for the current draft (shown in place, under the field). */
  error?: string | null
  /** Focus target so suggested prompts can hand focus back to the input. */
  inputRef?: React.RefObject<TextInput | null>
}

/**
 * Message composer.
 *
 * Enter inserts a newline (a multiline field on a phone makes an accidental
 * send far too easy); the Send button is the only submit path and it is disabled
 * while a turn is pending, so the same question cannot be charged twice. The
 * field is labelled and carries the error message as its accessibility hint.
 */
export function Composer({ value, onChangeText, onSend, sending, locked, error, inputRef }: ComposerProps) {
  const { theme } = useTheme()

  const trimmedLength = useMemo(() => value.trim().length, [value])
  const tooLong = trimmedLength > AGENT_MESSAGE_MAX_CHARS
  const showCounter = trimmedLength > AGENT_MESSAGE_MAX_CHARS * 0.8
  const canSend = trimmedLength > 0 && !tooLong && !sending && !locked

  return (
    <View
      style={{
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.border,
        backgroundColor: theme.bg,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        gap: 6,
      }}
    >
      {showCounter && (
        <Text
          style={{
            ...t.micro,
            textAlign: 'right',
            color: tooLong ? theme.danger : theme.text3,
          }}
        >
          {trimmedLength.toLocaleString('en-US')} / {AGENT_MESSAGE_MAX_CHARS.toLocaleString('en-US')}
        </Text>
      )}

      {!!error && (
        <Text style={{ ...t.sub, color: theme.danger }} accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          multiline
          editable={!locked}
          maxLength={AGENT_MESSAGE_MAX_CHARS + 500}
          placeholder="Ask about your machines…"
          placeholderTextColor={theme.text3}
          accessibilityLabel="Ask the assistant about your machine"
          accessibilityHint={
            error ?? 'Type a question about your machines, telemetry, events or fault codes.'
          }
          style={[
            styles.input,
            {
              backgroundColor: theme.surface,
              borderColor: error ? theme.danger : theme.borderStrong,
              color: theme.text,
              opacity: locked ? 0.6 : 1,
            },
          ]}
        />

        <Pressable
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send question"
          accessibilityState={{ disabled: !canSend }}
          hitSlop={4}
          style={({ pressed }) => [
            styles.send,
            {
              backgroundColor: canSend ? theme.accent : theme.surface3,
              opacity: pressed && canSend ? 0.85 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator size="small" color={theme.accentContrast} />
          ) : (
            <SendIcon size={19} color={canSend ? theme.accentContrast : theme.text3} />
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    maxHeight: 132,
    minHeight: 46,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
    paddingHorizontal: spacing.md + 2,
    paddingTop: 13,
    paddingBottom: 13,
    fontSize: 14.5,
    fontWeight: '600',
  },
  send: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

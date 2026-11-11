import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../contexts/ThemeContext'
import { formatTime } from '../../lib/format'
import type { ChatMessage } from '../../lib/agentContract'
import { radius, spacing } from '../../theme/tokens'
import { LogoIcon } from '../icons'
import { ToolCallList } from './ToolCallList'

/**
 * One transcript row.
 *
 * Assistant text is UNTRUSTED: it is rendered as a `<Text>` child, which in
 * React Native is always a text node — there is no HTML layer, no
 * `dangerouslySetInnerHTML`, no Markdown parser and no auto-linking, so model
 * output cannot become UI or execute anything.
 */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const { theme } = useTheme()
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <View style={styles.rowRight}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: theme.accent,
              borderTopRightRadius: radius.sm,
            },
          ]}
        >
          <Text style={{ fontSize: 13.5, lineHeight: 20, color: theme.accentContrast }} selectable>
            {message.content}
          </Text>
        </View>
        <TimeStamp iso={message.createdAt} />
      </View>
    )
  }

  return (
    <View style={styles.rowLeft}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: theme.surface,
            borderColor: theme.border,
            borderWidth: StyleSheet.hairlineWidth * 1.5,
            borderTopLeftRadius: radius.sm,
          },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 7,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accentSoft,
            }}
          >
            <LogoIcon size={13} color={theme.accentStrong} />
          </View>
          <Text style={{ fontSize: 11, fontWeight: '800', color: theme.text3, letterSpacing: 0.3 }}>
            ASSISTANT
          </Text>
        </View>
        <Text
          selectable
          style={{ fontSize: 13.5, lineHeight: 20.5, color: theme.text, marginTop: 7 }}
        >
          {message.content}
        </Text>
        <ToolCallList calls={message.toolCalls} />
      </View>
      <TimeStamp iso={message.createdAt} />
    </View>
  )
}

/** Timestamp shown under a bubble; nothing when the backend sent none. */
function TimeStamp({ iso }: { iso: string }) {
  const { theme } = useTheme()
  const parsed = new Date(iso).getTime()
  if (!iso || !Number.isFinite(parsed)) return null

  return (
    <Text style={{ fontSize: 10, fontWeight: '600', color: theme.text3, marginTop: 3, paddingHorizontal: 4 }}>
      {formatTime(iso)}
    </Text>
  )
}

const styles = StyleSheet.create({
  rowRight: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  rowLeft: {
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
  },
  bubble: {
    maxWidth: '92%',
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
})

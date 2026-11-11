import { StyleSheet, Text, View } from 'react-native'

import { useTheme } from '../../contexts/ThemeContext'
import { describeToolCall } from '../../lib/agentContract'
import type { AgentToolCall } from '../../data/api'
import { radius, spacing } from '../../theme/tokens'
import { ActivityIcon, AlertOctagonIcon } from '../icons'

/**
 * Read-only tool activity for one assistant turn.
 *
 * The backend sends only `{ name, summary }` — no payloads — so nothing here is
 * rendered as a trusted UI component. Known names map to a friendly label;
 * unknown names are shown verbatim (they are constants, never model text).
 */
export function ToolCallList({ calls }: { calls: AgentToolCall[] }) {
  const { theme } = useTheme()
  if (calls.length === 0) return null

  return (
    <View style={{ gap: 6, marginTop: spacing.sm }}>
      {calls.map((call, index) => {
        const { label, detail, failed } = describeToolCall(call)
        const fg = failed ? theme.danger : theme.accentStrong
        return (
          <View
            key={`${call.name}-${index}`}
            style={[
              styles.pill,
              {
                backgroundColor: failed ? theme.dangerBg : theme.accentSoft,
                borderColor: failed ? theme.dangerBg : theme.accentBorder,
              },
            ]}
          >
            {failed ? <AlertOctagonIcon size={13} color={fg} /> : <ActivityIcon size={13} color={fg} />}
            <Text numberOfLines={2} style={{ flex: 1, fontSize: 11.5, fontWeight: '700', color: fg }}>
              {label}
            </Text>
            {!!detail && (
              <Text numberOfLines={1} style={{ fontSize: 10.5, color: theme.text2, maxWidth: '45%' }}>
                {detail}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth * 1.5,
  },
})

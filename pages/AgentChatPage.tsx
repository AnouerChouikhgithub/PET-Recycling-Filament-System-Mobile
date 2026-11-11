import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useMachine } from '../contexts/MachineContext'
import { useTheme } from '../contexts/ThemeContext'
import { useToast } from '../contexts/ToastContext'
import { validateMessage, type ChatMessage } from '../lib/agentContract'
import { describeTelemetryFreshness } from '../lib/telemetryFreshness'
import { useAgentChat } from '../lib/useAgentChat'
import type { RootStackParamList } from '../lib/navigation'
import { radius, spacing, type as t } from '../theme/tokens'
import { AppButton, Sheet } from '../components/ui'
import { ChevronLeftIcon, SparklesIcon, TrashIcon } from '../components/icons'
import { Composer } from '../components/agent/Composer'
import { MessageBubble } from '../components/agent/MessageBubble'
import { SuggestedPrompts } from '../components/agent/SuggestedPrompts'
import {
  AssistantUnavailable,
  FailureNotice,
  MachineDataStrip,
  RateLimitBanner,
  StaleDataBanner,
  ThinkingRow,
} from '../components/agent/AgentNotices'

type Nav = NativeStackNavigationProp<RootStackParamList>

/**
 * AI assistant screen (stack route `AgentChat`).
 *
 * It lives inside the normal authenticated shell: same tokens, same API client,
 * same JWT. The assistant is READ-ONLY — this screen never calls a machine
 * command endpoint, never polls, and never renders model text as anything but
 * text.
 */
export function AgentChatPage() {
  const { theme } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<Nav>()
  const toast = useToast()
  const { telemetry } = useMachine()

  const {
    messages,
    conversationId,
    sending,
    notice,
    disabled,
    rateLimited,
    rateLimitRemainingSeconds,
    canRetry,
    send,
    retry,
    startNewConversation,
    deleteConversation,
    deleteAllConversations,
    dismissNotice,
  } = useAgentChat()

  const [draft, setDraft] = useState('')
  const [draftError, setDraftError] = useState<string | null>(null)
  const [staleDismissed, setStaleDismissed] = useState(false)
  const [confirming, setConfirming] = useState<'one' | 'all' | null>(null)
  const [deleting, setDeleting] = useState(false)

  const listRef = useRef<FlatList<ChatMessage>>(null)
  const inputRef = useRef<TextInput>(null)
  const nearBottom = useRef(true)

  const freshness = describeTelemetryFreshness(telemetry?.recordedAt)
  const showStaleBanner = !staleDismissed && (freshness.label === 'stale' || freshness.label === 'very_stale')

  /* Auto-scroll ONLY when the reader is already near the bottom (or just sent),
     so reading older answers is never interrupted. */
  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent
    const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
    nearBottom.current = distanceFromBottom < 80
  }, [])

  useEffect(() => {
    if (messages.length === 0) return
    if (!nearBottom.current) return
    const timer = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60)
    return () => clearTimeout(timer)
  }, [messages.length, sending])

  const submit = useCallback(async () => {
    const error = validateMessage(draft)
    if (error) {
      setDraftError(error)
      return
    }
    setDraftError(null)
    const text = draft
    // Cleared immediately: the question is already visible in the thread, so
    // nothing is lost, and the failure path offers an explicit Retry.
    setDraft('')
    nearBottom.current = true
    await send(text)
  }, [draft, send])

  const pickPrompt = useCallback((prompt: string) => {
    setDraft(prompt)
    setDraftError(null)
    inputRef.current?.focus()
  }, [])

  const runDelete = useCallback(
    async (which: 'one' | 'all') => {
      setDeleting(true)
      const ok = which === 'one' ? await deleteConversation() : await deleteAllConversations()
      setDeleting(false)
      setConfirming(null)
      if (ok) {
        toast.push('success', which === 'one' ? 'Conversation deleted' : 'Conversations deleted', 'Removed on the backend.')
      }
    },
    [deleteAllConversations, deleteConversation, toast],
  )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
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
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={4}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <ChevronLeftIcon size={20} color={theme.text} />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.accentSoft,
            }}
          >
            <SparklesIcon size={15} color={theme.accentStrong} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontSize: 15.5, fontWeight: '800', color: theme.text }}>
              AI assistant
            </Text>
            <Text numberOfLines={1} style={{ fontSize: 11, color: theme.text2 }}>
              Read-only · answers can be out of date
            </Text>
          </View>
        </View>

        {conversationId !== null && !disabled && (
          <Pressable
            onPress={() => setConfirming('one')}
            accessibilityRole="button"
            accessibilityLabel="Delete this conversation"
            hitSlop={4}
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <TrashIcon size={18} color={theme.text2} />
          </Pressable>
        )}
      </View>

      {disabled ? (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <AssistantUnavailable />
        </View>
      ) : (
        <>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <MessageBubble message={item} />}
            onScroll={onScroll}
            scrollEventThrottle={64}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingTop: spacing.md,
              paddingBottom: spacing.lg,
              gap: spacing.lg,
              flexGrow: 1,
            }}
            ListHeaderComponent={
              <View style={{ gap: spacing.md }}>
                <MachineDataStrip />
                {messages.length > 0 && (
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.lg,
                      flexWrap: 'wrap',
                    }}
                  >
                    <AppButton size="sm" variant="secondary" onPress={startNewConversation}>
                      New conversation
                    </AppButton>
                    <AppButton size="sm" variant="ghost" onPress={() => setConfirming('all')}>
                      Delete all history
                    </AppButton>
                  </View>
                )}
              </View>
            }
            ListEmptyComponent={sending ? null : <SuggestedPrompts onPick={pickPrompt} />}
            ListFooterComponent={
              <View style={{ gap: spacing.md, marginTop: spacing.md }}>
                {sending && <ThinkingRow />}
                {notice && (
                  <FailureNotice
                    notice={notice}
                    canRetry={canRetry}
                    onRetry={() => {
                      void retry()
                    }}
                    onDismiss={dismissNotice}
                  />
                )}
              </View>
            }
          />

          <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            {rateLimited && rateLimitRemainingSeconds !== null && (
              <RateLimitBanner seconds={rateLimitRemainingSeconds} />
            )}
            {showStaleBanner && (
              <StaleDataBanner
                ageSeconds={freshness.ageSeconds}
                label={freshness.label}
                onDismiss={() => setStaleDismissed(true)}
              />
            )}

            <Composer
              value={draft}
              onChangeText={(text) => {
                setDraft(text)
                if (draftError) setDraftError(null)
              }}
              onSend={() => {
                void submit()
              }}
              sending={sending}
              locked={rateLimited}
              error={draftError}
              inputRef={inputRef}
            />
            <Text
              style={{
                ...t.micro,
                color: theme.text3,
                textAlign: 'center',
                paddingBottom: insets.bottom + 6,
              }}
            >
              Read-only assistant · it can read machines, telemetry, events and activity
            </Text>
          </View>
        </>
      )}

      {/* Delete confirmations */}
      <Sheet
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={confirming === 'all' ? 'Delete all conversations?' : 'Delete this conversation?'}
        subtitle={
          confirming === 'all'
            ? 'Every AI conversation on your account is removed from the backend. This cannot be undone.'
            : 'The conversation is removed from the backend. This cannot be undone.'
        }
        actions={
          <>
            <AppButton variant="secondary" style={{ flex: 1 }} onPress={() => setConfirming(null)}>
              Cancel
            </AppButton>
            <AppButton
              variant="danger"
              style={{ flex: 1 }}
              loading={deleting}
              onPress={() => {
                void runDelete(confirming === 'all' ? 'all' : 'one')
              }}
            >
              Delete
            </AppButton>
          </>
        }
      >
        <Text style={{ ...t.sub, color: theme.text2, lineHeight: 18 }}>
          {confirming === 'all'
            ? 'The assistant keeps the last few messages of the active conversation on the server so it can answer follow-up questions. Deleting removes them.'
            : 'Chats are stored server-side so the assistant can follow up. Deleting removes this one.'}
        </Text>
      </Sheet>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
})

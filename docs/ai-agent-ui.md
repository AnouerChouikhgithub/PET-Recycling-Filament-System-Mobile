# AI Agent Chat UI - Mobile / Expo (docs only)

Fits the existing app: React Native 0.86 + Expo 57, react-navigation
(bottom-tabs + native-stack), api client in api/client.ts + data/api.ts
(fetch + expo-secure-store token, same envelope/ApiError pattern as web),
wall-clock polling service in realtime/realtimeService.ts (10 s interval).
Nothing in this app ever contacts Anthropic: it only exchanges JSON/SSE
frames with the Symfony backend.

## 1. Entry point & navigation

- A new stacked screen AgentChatScreen (from MachinePage header icon and a
  ProfilePage row): react-navigation/native-stack push, no new tab needed.
- Thread-only v1 (no conversation list screen); conversation switching is a
  "New conversation" action in the app bar, state kept in a small
  AgentContext (provider next to the existing contexts).

## 2. Streaming caveats on React Native - WHY non-streaming is primary

React Native's fetch does NOT support streaming response bodies (XHR-based;
no incremental ReadableStream in the JS layer on current RN release
targets), and Expo Go/remote debugging differ again. Design accordingly:

- PRIMARY: the non-streaming fallback (Accept: application/json). One
  round-trip per turn; a "thinking" indicator during the wait.
- Prepared (Future): streaming upgrade via expo/fetch's streaming support
  (expo >= 49 SDK fetch polyfill) or a SSE-capable library once the backend
  contract is proven. The frame schema is transport-independent, so the
  upgrade touches only api/agent.ts.
- Regardless of transport: turn already-visible frames are appended; all
  frames use the same shape (delta/tool/pending_action/done/error), so the
  UI layer is identical between web and mobile.
- Timeout: the platform fetch has no incremental timeout; pin AbortSignal
  timeout (AbortSignal.timeout(60_000)) so a hung turn recovers.

## 3. Message list (FlatList)

- FlatList with inverted={true} (newest at the bottom without layout
  thrash): the rows list is kept reversed in state; renderItem renders
  bubble (user right/assistant left per theme), sizes with
  getItemLayout when height becomes metro-measurable, removeClippedSubviews
  on, initialNumToRender 12, maxToRenderPerBatch 8.
- KeyboardAvoidingView (behavior 'padding' on iOS, 'height' on Android),
  ScrollView contentContainerStyle pinned above the input bar; safe-area
  insets via the existing react-native-safe-area-context shell (Shell.tsx).

## 4. Tool-call indicator

Same pattern as web: a small inline row (glyph + "checked latest telemetry")
with in-flight spinner; persisted via message.toolCalls. No raw payloads
(the backend only sends name + summary).

## 5. Stale-data banner

A banner component above the composer when the last turn included the
staleness labels from the backend ("- stale" / "very stale, telemetry
missing"), phrased in plain words ("last sample X old - values may be
outdated"). Dismissable; re-shown on new stale turns.

## 6. Error and rate-limit states

| Condition                  | UI                                                     |
|----------------------------|--------------------------------------------------------|
| 429 AGENT_RATE_LIMITED     | banner + countdown from Retry-After, composer disabled |
| 429 AGENT_DAILY_TOKEN_CAP  | banner "Daily AI usage limit reached, resets 00:00 UTC"|
| 503 AGENT_LLM_UNAVAILABLE  | inline error bubble + Retry button                     |
| network failure / timeout  | inline error bubble + Retry                            |
| 401                        | existing client 401 -> logout flow                     |
| 404 AGENT_DISABLED         | screen shows "Assistant not available"; entry hidden   |

Retry uses the non-streaming call (idempotent from UI perspective: the turn
was NOT persisted on 429/503 pre-persist failures; partial stream content
must never be silently re-sent - the retry starts a new turn like web).

## 7. AppState pause

- AppState listener in AgentChatScreen/AgentContext: when
  appState !== 'active', pause any in-flight turn (abort the fetch), keep
  the drafted composer text, show "(paused - in background)" on the
  interrupted bubble; on 'active', offer a one-tap Retry.
- This keeps battery/data sane: unlike dashboards, chat has no 10 s polling
  to throttle; the 10 s realtimeService keeps living untouched for the
  machine screens.

## 8. Phase 2 confirmation card

Same shape as web: pending_action -> card (machine name, plain-language
command, Confirm / Cancel, expiry countdown). Confirm calls the NORMAL
POST /api/machines/{id}/commands through api/client, showing "sent for
execution (pending device report)" on success - the app never claims
execution, matching the existing honesty rules in the MQTT contract.

## 9. Notes

- Message content stays out of AsyncStorage (session-bound screen state;
  refresh pulls history from the backend, authenticated).
- Selected for Future: streaming frames over expo/fetch streaming once the
  backend ships; an inline conversation-list screen.


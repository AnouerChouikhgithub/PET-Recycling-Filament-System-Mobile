/**
 * Stack routes. Shared so tab screens can push deeper pages (History,
 * Filament, the AI assistant) with a typed navigation call instead of
 * threading callbacks through props.
 */
export type RootStackParamList = {
  Tabs: undefined
  History: undefined
  Filament: undefined
  AgentChat: undefined
}

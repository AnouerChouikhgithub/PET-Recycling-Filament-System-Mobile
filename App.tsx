import { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { MachineProvider, useMachine } from './contexts/MachineContext'
import { AppHeader, ConnectionRibbon, NotificationsSheet, TabBar, type TabRoute } from './components/Shell'
import { ToastHost } from './components/ui'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { MachinePage } from './pages/MachinePage'
import { RecyclingPage } from './pages/RecyclingPage'
import { ImpactPage } from './pages/ImpactPage'
import { ProfilePage } from './pages/ProfilePage'
import { FilamentPage } from './pages/FilamentPage'
import { HistoryPage } from './pages/HistoryPage'

/* Navigation: 5 primary destinations in the bottom tab bar;
   History and Filament are pushed as stack screens (deeper content). */
type RootStackParamList = {
  Tabs: undefined
  History: undefined
  Filament: undefined
}
const Stack = createNativeStackNavigator<RootStackParamList>()
const Tab = createBottomTabNavigator()

const TAB_META: Record<TabRoute, { title: string; sub: string }> = {
  Home: { title: '3awedlou', sub: 'Smart PET recycling' },
  Machine: { title: 'Machine', sub: 'Live sensors & controls' },
  Recycling: { title: 'Recycling', sub: 'Sessions & output' },
  Impact: { title: 'Impact', sub: 'Your environmental footprint' },
  Profile: { title: 'Profile', sub: 'Preferences & settings' },
}

/** Tab navigator with the shared header + connection ribbon above it. */
function TabsWithChrome({
  onOpenNotifications,
  unread,
}: {
  onOpenNotifications: () => void
  unread: number
}) {
  const { theme, toggle } = useTheme()
  const [activeTab, setActiveTab] = useState<TabRoute>('Home')
  const meta = TAB_META[activeTab]

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <AppHeader
        title={meta.title}
        subtitle={meta.sub}
        onToggleTheme={toggle}
        onOpenNotifications={onOpenNotifications}
        unread={unread}
      />
      <ConnectionRibbon />
      <Tab.Navigator
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <ChromeBar
            state={props.state}
            navigation={props.navigation}
            onActive={setActiveTab}
            unread={unread}
          />
        )}
      >
        <Tab.Screen name="Home" component={HomePage} />
        <Tab.Screen name="Machine" component={MachinePage} />
        <Tab.Screen name="Recycling" component={RecyclingPage} />
        <Tab.Screen name="Impact" component={ImpactPage} />
        <Tab.Screen name="Profile" component={ProfilePage} />
      </Tab.Navigator>
    </View>
  )
}

/** Bridges tab state changes to the header without render side effects. */
function ChromeBar({
  state,
  navigation,
  onActive,
  unread,
}: {
  state: { routes: { name?: string }[]; index: number }
  navigation: { navigate: (r: TabRoute) => void }
  onActive: (t: TabRoute) => void
  unread: number
}) {
  const activeName = (state.routes[state.index]?.name ?? 'Home') as TabRoute
  useEffect(() => {
    onActive(activeName)
  }, [activeName, onActive])
  return <TabBar active={activeName} onChange={(r) => navigation.navigate(r)} unreadAlerts={unread} />
}

function AppShell() {
  const { theme } = useTheme()
  const { unreadAlerts } = useMachine()
  const [notifOpen, setNotifOpen] = useState(false)

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Tabs">
          {() => (
            <TabsWithChrome
              onOpenNotifications={() => setNotifOpen(true)}
              unread={unreadAlerts}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="History" component={HistoryPage} />
        <Stack.Screen name="Filament" component={FilamentPage} />
      </Stack.Navigator>
      <NotificationsSheet open={notifOpen} onClose={() => setNotifOpen(false)} />
      <ToastHost />
    </View>
  )
}

/** Auth gate: login screen until signed in, then the machine-backed shell. */
function Gate() {
  const { theme } = useTheme()
  const { user, initializing } = useAuth()

  if (initializing) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} size="large" />
      </View>
    )
  }

  if (!user) return <LoginPage />

  return (
    <MachineProvider>
      <AppShell />
    </MachineProvider>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <NavigationContainer>
              <Gate />
            </NavigationContainer>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}

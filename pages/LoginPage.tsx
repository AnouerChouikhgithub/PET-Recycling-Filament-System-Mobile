/**
 * Login / registration — the gate in front of the tab app.
 * Visual identity: same tokens, spacing and green brand accent as the app.
 */
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useAuth, isCredentialsError } from '../contexts/AuthContext'
import { ApiError } from '../api/client'
import { useTheme } from '../contexts/ThemeContext'
import { radius, spacing } from '../theme/tokens'

type Mode = 'login' | 'register'

function TextInputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  autoComplete,
}: {
  label: string
  value: string
  onChangeText: (v: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  autoCapitalize?: 'none' | 'words' | 'sentences'
  keyboardType?: 'default' | 'email-address'
  autoComplete?: string
}) {
  const { theme } = useTheme()
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: theme.text3 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.text3}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoCorrect={false}
        keyboardType={keyboardType ?? 'default'}
        autoComplete={autoComplete as never}
        style={{
          backgroundColor: theme.surface2,
          borderRadius: radius.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.borderStrong,
          paddingHorizontal: spacing.md,
          paddingVertical: 12,
          fontSize: 15,
          color: theme.text,
        }}
      />
    </View>
  )
}

export function LoginPage() {
  const { theme } = useTheme()
  const { login, register, loginInProgress } = useAuth()
  const insets = useSafeAreaInsets()
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (loginInProgress) return
    setError(null)
    try {
      if (mode === 'login') await login(email.trim(), password)
      else await register(email.trim(), password, name.trim() || email.split('@')[0])
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const first = Object.values(err.details)[0]?.[0]
        setError(first ?? err.message)
      } else if (isCredentialsError(err)) {
        setError('Invalid email or password.')
      } else {
        setError((err as Error).message || 'Sign-in failed. Please try again.')
      }
    }
  }

  const valid = email.includes('@') && password.length >= (mode === 'login' ? 1 : 8)

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: spacing.lg,
          paddingTop: insets.top + spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand */}
        <View style={{ alignItems: 'center', gap: 8 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 22,
              backgroundColor: theme.accent,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: theme.accentContrast, fontSize: 30, fontWeight: '800' }}>3</Text>
          </View>
          <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: -0.5, color: theme.text }}>
            3awedlou
          </Text>
          <Text style={{ fontSize: 12.5, color: theme.text2 }}>
            Plastic today. A brighter tomorrow.
          </Text>
        </View>

        <View style={{ gap: 3 }}>
          <Text style={{ fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: theme.text3 }}>
            {mode === 'login' ? 'WELCOME BACK' : 'CREATE ACCOUNT'}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: '800', letterSpacing: -0.4, color: theme.text }}>
            {mode === 'login' ? 'Sign in to your machine.' : 'Join 3awedlou.'}
          </Text>
        </View>

        {mode === 'register' && (
          <TextInputField label="Name" value={name} onChangeText={setName} autoCapitalize="words" placeholder="Your name" />
        )}
        <TextInputField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={mode === 'login' ? 'password' : 'new-password'}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
        />

        {error && (
          <View
            style={{
              backgroundColor: theme.dangerBg,
              borderRadius: radius.md,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.border,
              padding: spacing.md,
            }}
          >
            <Text style={{ fontSize: 12.5, lineHeight: 18, color: theme.danger, fontWeight: '600' }}>
              {error}
            </Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={!valid || loginInProgress}
          style={({ pressed }) => ({
            backgroundColor: valid ? theme.accent : theme.surface3,
            borderRadius: radius.md,
            paddingVertical: 15,
            alignItems: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {loginInProgress ? (
            <ActivityIndicator color={theme.accentContrast} />
          ) : (
            <Text style={{ color: valid ? theme.accentContrast : theme.text3, fontSize: 15, fontWeight: '800' }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login')
            setError(null)
          }}
          style={({ pressed }) => ({ alignItems: 'center', padding: 8, opacity: pressed ? 0.7 : 1 })}
        >
          <Text style={{ fontSize: 13, color: theme.text2 }}>
            {mode === 'login' ? 'New to 3awedlou? ' : 'Already have an account? '}
            <Text style={{ color: theme.accentStrong, fontWeight: '800' }}>
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>

        <Text style={{ fontSize: 11.5, color: theme.text3, textAlign: 'center', lineHeight: 17 }}>
          Connects to the 3awedlou backend. On a physical device, make sure
          EXPO_PUBLIC_API_BASE_URL in .env points to your computer's LAN IP.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

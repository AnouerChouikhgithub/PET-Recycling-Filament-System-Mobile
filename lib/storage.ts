/** Thin wrapper over AsyncStorage with safe fallbacks. */
import AsyncStorage from '@react-native-async-storage/async-storage'

export const storage = {
  async getString(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key)
    } catch {
      return null
    }
  },
  async setString(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value)
    } catch {
      /* ignore */
    }
  },
}

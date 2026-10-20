/**
 * Jest config for the React Native RENDER tests.
 *
 * The pure contract logic is covered by `node --test __tests__/*.mjs` (see
 * `npm test`); jest is pointed exclusively at `*.render.test.tsx` so the two
 * runners never pick up each other's files.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.render.test.tsx'],
  moduleNameMapper: {
    // ThemeProvider persists via AsyncStorage — use the official mock.
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
}

/**
 * Jest config for the React Native RENDER tests.
 *
 * The pure contract logic is covered by `node --test __tests__/*.mjs` (see
 * `npm test`); jest is pointed at `*.render.test.tsx` (component renders) and
 * `*.unit.test.tsx` (a React Native module under a mocked platform API) so the
 * two runners never pick up each other's files.
 */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.render.test.tsx', '**/*.unit.test.tsx'],
  moduleNameMapper: {
    // ThemeProvider persists via AsyncStorage — use the official mock.
    '^@react-native-async-storage/async-storage$':
      '@react-native-async-storage/async-storage/jest/async-storage-mock',
  },
}

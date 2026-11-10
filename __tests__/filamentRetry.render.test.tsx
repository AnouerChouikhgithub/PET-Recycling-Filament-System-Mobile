/**
 * Render test for the filament library retry action.
 *
 * The retry used to call `setError(null)` only, leaving an empty screen until
 * the machine id changed. Tapping Refresh must issue a second production
 * request and repaint from its result.
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'

import { FilamentPage } from '../pages/FilamentPage'
import { ThemeProvider } from '../contexts/ThemeContext'
import { machinesApi } from '../api'

jest.mock('../api', () => ({
  machinesApi: { production: jest.fn() },
}))

jest.mock('../contexts/MachineContext', () => ({
  useMachine: () => ({ selectedId: 'm1' }),
}))

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: 'cache' } }))
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }))

jest.setTimeout(20_000)

const production = machinesApi.production as jest.MockedFunction<typeof machinesApi.production>

function renderPage() {
  return render(
    <ThemeProvider>
      <FilamentPage />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  production.mockReset()
})

describe('FilamentPage retry', () => {
  it('re-requests production data when Refresh is tapped after a failure', async () => {
    production.mockRejectedValueOnce(new Error('Backend unavailable.'))
    production.mockResolvedValueOnce([])

    renderPage()

    await waitFor(() => expect(screen.getByText('Backend unreachable')).toBeTruthy(), { timeout: 8000 })
    expect(production).toHaveBeenCalledTimes(1)

    fireEvent.press(screen.getByText('Refresh'))

    await waitFor(() => expect(production).toHaveBeenCalledTimes(2), { timeout: 8000 })
    await waitFor(() => expect(screen.getByText('No batches yet')).toBeTruthy(), { timeout: 8000 })
    expect(screen.queryByText('Backend unreachable')).toBeNull()
  })
})

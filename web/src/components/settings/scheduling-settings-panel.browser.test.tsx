import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SchedulingSettingsPanel } from '#components/settings/scheduling-settings-panel'
import {
  useSchedulingSettings,
  useUpdateSchedulingSettings,
} from '#hooks/use-scheduling-settings'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-scheduling-settings', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-scheduling-settings')>()
  return {
    ...original,
    useSchedulingSettings: vi.fn(),
    useUpdateSchedulingSettings: vi.fn(),
  }
})

const mockUseSchedulingSettings = vi.mocked(useSchedulingSettings)
const mockUseUpdateSchedulingSettings = vi.mocked(useUpdateSchedulingSettings)

beforeEach(() => {
  vi.clearAllMocks()
  mockUseSchedulingSettings.mockReturnValue(
    partialMutation<ReturnType<typeof useSchedulingSettings>>({
      isLoading: false,
      isSuccess: true,
      data: {
        workingHoursStart: '09:00',
        workingHoursEnd: '18:00',
        minimumBlockMinutes: 30,
        autoRescheduleOnGcalChange: true,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    }),
  )
  mockUseUpdateSchedulingSettings.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdateSchedulingSettings>>({
      mutate: vi.fn(),
      isPending: false,
    }),
  )
})

describe('SchedulingSettingsPanel', () => {
  it('saves the auto-reschedule setting when it is disabled', async () => {
    const mutate =
      vi.fn<ReturnType<typeof useUpdateSchedulingSettings>['mutate']>()
    mockUseUpdateSchedulingSettings.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateSchedulingSettings>>({
        mutate,
        isPending: false,
      }),
    )
    const user = userEvent.setup()
    render(<SchedulingSettingsPanel />)

    await user.click(screen.getByRole('button', { name: '無効' }))

    expect(mutate.mock.calls.map(([input]) => input)).toEqual([
      { autoRescheduleOnGcalChange: false },
    ])
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PrioritySettingsPanel } from '#components/settings/priority-settings-panel'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import {
  type UpdatePrioritySettingsInput,
  usePrioritySettings,
  useUpdatePrioritySettings,
} from '#hooks/use-priority-settings'
import { assertDefined, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-priority-settings', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-priority-settings')>()
  return {
    ...original,
    usePrioritySettings: vi.fn(),
    useUpdatePrioritySettings: vi.fn(),
  }
})

const mockUsePrioritySettings = vi.mocked(usePrioritySettings)
const mockUseUpdatePrioritySettings = vi.mocked(useUpdatePrioritySettings)
const mutate = vi.fn<(settings: UpdatePrioritySettingsInput) => void>()

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUsePrioritySettings.mockReturnValue(
    partialMutation<ReturnType<typeof usePrioritySettings>>({
      isLoading: false,
      isSuccess: true,
      data: makePrioritySettings(),
    }),
  )
  mockUseUpdatePrioritySettings.mockReturnValue(
    partialMutation<ReturnType<typeof useUpdatePrioritySettings>>({
      mutate,
      isPending: false,
      isError: false,
    }),
  )
})

describe('PrioritySettingsPanel', () => {
  it('saves edited names and descriptions in the selected order', async () => {
    const user = userEvent.setup()
    render(
      <Providers>
        <PrioritySettingsPanel />
      </Providers>,
    )

    await user.click(screen.getByRole('button', { name: 'Now を下へ' }))
    const nameInput = screen.getByRole('textbox', { name: 'Now の表示名' })
    const descriptionInput = screen.getByRole('textbox', { name: 'Now の説明' })
    await user.clear(nameInput)
    await user.type(nameInput, 'Soon')
    await user.type(descriptionInput, 'Handle this after the next item.')
    await user.click(screen.getByRole('button', { name: '保存' }))

    const original = makePrioritySettings()
    const expectedOrder = [1, 2, 0, null, -1]
    const expected = expectedOrder.map((priority, sortOrder) => {
      const setting = assertDefined(
        original.find((candidate) => candidate.priority === priority),
      )
      return {
        ...setting,
        ...(priority === 2
          ? { name: 'Soon', description: 'Handle this after the next item.' }
          : {}),
        sortOrder,
      }
    })
    expect(mutate.mock.calls).toEqual([[expected]])
  })
})

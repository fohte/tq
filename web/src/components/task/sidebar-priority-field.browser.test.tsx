import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { SidebarPriorityField } from '#components/task/sidebar-priority-field'
import { useUpdateTask } from '#hooks/use-tasks'
import { prioritySettingsKeys } from '#lib/query-keys'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return { ...original, useUpdateTask: vi.fn() }
})

const mockUseUpdateTask = vi.mocked(useUpdateTask)
const taskId = '00000000-0000-0000-0000-000000000001'

describe('SidebarPriorityField', () => {
  it('saves the selected configured priority value', async () => {
    const mutate = vi.fn<ReturnType<typeof useUpdateTask>['mutate']>()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateTask>>({ mutate }),
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(prioritySettingsKeys.all, makePrioritySettings())
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarPriorityField taskId={taskId} priority={0} />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('combobox', { name: 'Priority' }))
    await user.click(screen.getByText('Later'))

    expect(mutate.mock.calls).toEqual([
      [{ id: taskId, input: { priority: -1 } }],
    ])
  })

  it('clears a configured priority when Inbox is selected', async () => {
    const mutate = vi.fn<ReturnType<typeof useUpdateTask>['mutate']>()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<ReturnType<typeof useUpdateTask>>({ mutate }),
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    queryClient.setQueryData(prioritySettingsKeys.all, makePrioritySettings())
    const user = userEvent.setup({
      pointerEventsCheck: PointerEventsCheckLevel.Never,
    })

    render(
      <QueryClientProvider client={queryClient}>
        <SidebarPriorityField taskId={taskId} priority={-1} />
      </QueryClientProvider>,
    )

    await user.click(screen.getByRole('combobox', { name: 'Priority' }))
    await user.click(screen.getByText('Inbox'))

    expect(mutate.mock.calls).toEqual([
      [{ id: taskId, input: { priority: null } }],
    ])
  })
})

import { DndContext } from '@dnd-kit/core'
import { SortableContext } from '@dnd-kit/sortable'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { QueueItemRow } from '#components/task/queue-item-row'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { useUpdateTask } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { partialMutation } from '#lib/test-utils'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useUpdateTask: vi.fn(),
  }
})

const mockUseUpdateTask = vi.mocked(useUpdateTask)

type UseUpdateTaskResult = ReturnType<typeof useUpdateTask>

const task = makeTask({
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Plan the launch',
  estimatedMinutes: null,
})

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        <DndContext>
          <SortableContext items={[task.id]}>{children}</SortableContext>
        </DndContext>
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

describe('QueueItemRow', () => {
  it('enters edit mode when the "No estimate" chip is clicked', async () => {
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(
      <Providers>
        <QueueItemRow task={task} queueKey="day" onRemove={vi.fn()} />
      </Providers>,
    )

    await user.click(await screen.findByText('No estimate'))

    expect(screen.getByPlaceholderText(formatMinutes(30))).toBeInTheDocument()
  })

  it('commits a valid duration on blur', async () => {
    const mutate = vi.fn()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <Providers>
        <QueueItemRow task={task} queueKey="day" onRemove={vi.fn()} />
      </Providers>,
    )

    await user.click(await screen.findByText('No estimate'))
    await user.type(screen.getByPlaceholderText(formatMinutes(30)), '45')
    await user.tab()

    expect(mutate).toHaveBeenCalledWith({
      id: task.id,
      input: { estimatedMinutes: 45 },
    })
  })

  it('exits edit mode after committing on blur', async () => {
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(
      <Providers>
        <QueueItemRow task={task} queueKey="day" onRemove={vi.fn()} />
      </Providers>,
    )

    await user.click(await screen.findByText('No estimate'))
    await user.type(screen.getByPlaceholderText(formatMinutes(30)), '45')
    await user.tab()

    expect(screen.getByText('No estimate')).toBeInTheDocument()
  })

  it('does not commit when Escape is pressed', async () => {
    const mutate = vi.fn()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <Providers>
        <QueueItemRow task={task} queueKey="day" onRemove={vi.fn()} />
      </Providers>,
    )

    await user.click(await screen.findByText('No estimate'))
    await user.type(screen.getByPlaceholderText(formatMinutes(30)), '45')
    await user.keyboard('{Escape}')

    expect(mutate).not.toHaveBeenCalled()
  })

  it('exits edit mode when Escape is pressed', async () => {
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(
      <Providers>
        <QueueItemRow task={task} queueKey="day" onRemove={vi.fn()} />
      </Providers>,
    )

    await user.click(await screen.findByText('No estimate'))
    await user.type(screen.getByPlaceholderText(formatMinutes(30)), '45')
    await user.keyboard('{Escape}')

    expect(screen.getByText('No estimate')).toBeInTheDocument()
  })

  it('commits on Enter by blurring the input', async () => {
    const mutate = vi.fn()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <Providers>
        <QueueItemRow task={task} queueKey="day" onRemove={vi.fn()} />
      </Providers>,
    )

    await user.click(await screen.findByText('No estimate'))
    await user.type(screen.getByPlaceholderText(formatMinutes(30)), '45{Enter}')

    expect(mutate).toHaveBeenCalledWith({
      id: task.id,
      input: { estimatedMinutes: 45 },
    })
  })
})

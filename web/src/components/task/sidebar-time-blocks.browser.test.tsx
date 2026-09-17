import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SidebarTimeBlocks } from '#components/task/sidebar-time-blocks'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { useRemoveFromDayQueue } from '#hooks/use-queues'
import { useDeleteManualTimeBlock } from '#hooks/use-time-blocks'

vi.mock('#hooks/use-time-blocks', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-time-blocks')>()
  return {
    ...original,
    useDeleteManualTimeBlock: vi.fn(),
  }
})

vi.mock('#hooks/use-queues', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-queues')>()
  return {
    ...original,
    useRemoveFromDayQueue: vi.fn(),
  }
})

const mockUseDeleteManualTimeBlock = vi.mocked(useDeleteManualTimeBlock)
const mockUseRemoveFromDayQueue = vi.mocked(useRemoveFromDayQueue)

const taskId = '00000000-0000-0000-0000-000000000001'

describe('SidebarTimeBlocks', () => {
  it('deletes a manual block once the delete dialog is confirmed', async () => {
    const onDelete = vi.fn()
    mockUseDeleteManualTimeBlock.mockReturnValue({
      onDelete,
      isDeleting: false,
    })
    mockUseRemoveFromDayQueue.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: false,
    })
    const manualBlock = makeTimeBlock({ taskId, isAutoScheduled: false })
    const user = userEvent.setup()
    render(<SidebarTimeBlocks taskId={taskId} timeBlocks={[manualBlock]} />)

    await user.click(screen.getByRole('button', { name: 'Delete time block' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('removes an auto-scheduled block from the queue once the delete dialog is confirmed', async () => {
    const onDelete = vi.fn()
    mockUseDeleteManualTimeBlock.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: false,
    })
    mockUseRemoveFromDayQueue.mockReturnValue({ onDelete, isDeleting: false })
    const autoBlock = makeTimeBlock({ taskId, isAutoScheduled: true })
    const user = userEvent.setup()
    render(<SidebarTimeBlocks taskId={taskId} timeBlocks={[autoBlock]} />)

    await user.click(screen.getByRole('button', { name: 'Remove from queue' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('disables the remove-from-queue button while the day queue is loading', () => {
    mockUseDeleteManualTimeBlock.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: false,
    })
    mockUseRemoveFromDayQueue.mockReturnValue({
      onDelete: vi.fn(),
      isDeleting: true,
    })
    const autoBlock = makeTimeBlock({ taskId, isAutoScheduled: true })
    render(<SidebarTimeBlocks taskId={taskId} timeBlocks={[autoBlock]} />)

    expect(
      screen.getByRole('button', { name: 'Remove from queue' }),
    ).toBeDisabled()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarTimeBlocks } from '#components/task/sidebar-time-blocks'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { useDeleteTimeBlock } from '#hooks/use-time-blocks'

vi.mock('#hooks/use-time-blocks', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('#hooks/use-time-blocks')>()
  return {
    ...original,
    useDeleteTimeBlock: vi.fn(),
  }
})

const mockUseDeleteTimeBlock = vi.mocked(useDeleteTimeBlock)

const taskId = '00000000-0000-0000-0000-000000000001'

function getDeleteOutput(deleteHookCalls: unknown, deleteCalls: number) {
  return { deleteHookCalls, deleteCalls }
}

beforeEach(() => {
  mockUseDeleteTimeBlock.mockReset()
})

describe('SidebarTimeBlocks', () => {
  it('deletes a manual block once the delete dialog is confirmed', async () => {
    const onDelete = vi.fn()
    mockUseDeleteTimeBlock.mockReturnValue({
      onDelete,
      isDeleting: false,
    })
    const manualBlock = makeTimeBlock({ taskId, isAutoScheduled: false })
    const user = userEvent.setup()
    render(<SidebarTimeBlocks taskId={taskId} timeBlocks={[manualBlock]} />)

    await user.click(screen.getByRole('button', { name: 'Delete time block' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(
      getDeleteOutput(
        mockUseDeleteTimeBlock.mock.calls,
        onDelete.mock.calls.length,
      ),
    ).toEqual({
      deleteHookCalls: [[taskId, manualBlock.id]],
      deleteCalls: 1,
    })
  })

  it('deletes an auto-scheduled block once the delete dialog is confirmed', async () => {
    const onDelete = vi.fn()
    mockUseDeleteTimeBlock.mockReturnValue({ onDelete, isDeleting: false })
    const autoBlock = makeTimeBlock({ taskId, isAutoScheduled: true })
    const user = userEvent.setup()
    render(<SidebarTimeBlocks taskId={taskId} timeBlocks={[autoBlock]} />)

    await user.click(screen.getByRole('button', { name: 'Delete time block' }))
    await user.click(await screen.findByRole('button', { name: 'Delete' }))

    expect(
      getDeleteOutput(
        mockUseDeleteTimeBlock.mock.calls,
        onDelete.mock.calls.length,
      ),
    ).toEqual({
      deleteHookCalls: [[taskId, autoBlock.id]],
      deleteCalls: 1,
    })
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteTaskDialog } from '#components/task/delete-task-dialog'
import { useDeleteTask } from '#hooks/use-tasks'
import {
  mutateInvokingOnSuccess,
  partialMutation,
  withOnSuccess,
} from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useDeleteTask: vi.fn(),
  }
})

const mockUseDeleteTask = vi.mocked(useDeleteTask)

type DeleteTaskResult = ReturnType<typeof useDeleteTask>

describe('DeleteTaskDialog', () => {
  it('calls mutate with the task id', async () => {
    const mutate = vi.fn<DeleteTaskResult['mutate']>()
    mockUseDeleteTask.mockReturnValue(
      partialMutation<DeleteTaskResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <DeleteTaskDialog
        open
        onOpenChange={vi.fn()}
        taskId="00000000-0000-0000-0000-000000000001"
        taskNumber={42}
        taskTitle="Fix the login redirect"
        taskHasParent={false}
        onDeleted={vi.fn()}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(mutate).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      withOnSuccess,
    )
  })

  it('calls onDeleted when the deletion succeeds', async () => {
    const mutate = mutateInvokingOnSuccess<DeleteTaskResult['mutate']>()
    mockUseDeleteTask.mockReturnValue(
      partialMutation<DeleteTaskResult>({ mutate }),
    )
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    render(
      <DeleteTaskDialog
        open
        onOpenChange={vi.fn()}
        taskId="00000000-0000-0000-0000-000000000001"
        taskNumber={42}
        taskTitle="Fix the login redirect"
        taskHasParent={false}
        onDeleted={onDeleted}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onDeleted).toHaveBeenCalled()
  })
})

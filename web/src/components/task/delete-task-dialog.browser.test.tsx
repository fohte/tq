import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DeleteTaskDialog } from '#components/task/delete-task-dialog'
import { useDeleteTask } from '#hooks/use-tasks'
import { partialMutation } from '#lib/test-utils'

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
  it('deletes the task and calls onDeleted on success', async () => {
    const mutate = vi.fn(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- test double: DeleteTaskDialog's onSuccess callback ignores every argument, so the exact mutate signature doesn't matter here
      ((_id: unknown, options?: { onSuccess?: () => void }) => {
        options?.onSuccess?.()
      }) as DeleteTaskResult['mutate'],
    )
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

    expect(mutate).toHaveBeenCalledWith(
      '00000000-0000-0000-0000-000000000001',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
    expect(onDeleted).toHaveBeenCalled()
  })
})

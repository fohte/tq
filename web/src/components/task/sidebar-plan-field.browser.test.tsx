import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SidebarPlanField } from '#components/task/sidebar-plan-field'
import type { TaskPriority } from '#hooks/use-priority-settings'
import { useTaskPlan } from '#hooks/use-queues'
import { useUpdateTask } from '#hooks/use-tasks'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-queues', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-queues')>()
  return {
    ...original,
    useTaskPlan: vi.fn(),
  }
})

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useUpdateTask: vi.fn(),
  }
})

const mockUseTaskPlan = vi.mocked(useTaskPlan)
const mockUseUpdateTask = vi.mocked(useUpdateTask)

type TaskPlanResult = ReturnType<typeof useTaskPlan>
type UpdateTaskResult = ReturnType<typeof useUpdateTask>

const taskId = '00000000-0000-0000-0000-000000000001'

function setUp(plan: TaskPlanResult['plan'] = '') {
  const setPlan = vi.fn<TaskPlanResult['setPlan']>()
  const mutate = vi.fn<UpdateTaskResult['mutate']>()
  mockUseTaskPlan.mockReturnValue(
    partialMutation<TaskPlanResult>({
      plan,
      position: null,
      setPlan,
      isLoading: false,
    }),
  )
  mockUseUpdateTask.mockReturnValue(
    partialMutation<UpdateTaskResult>({ mutate }),
  )
  return { setPlan, mutate }
}

describe('SidebarPlanField', () => {
  it('selecting "today" sets an unset priority to zero', async () => {
    const { setPlan, mutate } = setUp()
    const user = userEvent.setup()
    render(<SidebarPlanField taskId={taskId} priority={null} />)

    await user.click(screen.getByText('today'))

    const readResult = () => ({
      plan: setPlan.mock.calls,
      taskUpdates: mutate.mock.calls,
    })
    expect(readResult()).toEqual({
      plan: [['day']],
      taskUpdates: [[{ id: taskId, input: { priority: 0 } }]],
    })
  })

  it.each([-1, 0, 1, 2] as const)(
    'selecting "today" preserves the configured priority %s',
    async (priority: Exclude<TaskPriority, null>) => {
      const { setPlan, mutate } = setUp()
      const user = userEvent.setup()
      render(<SidebarPlanField taskId={taskId} priority={priority} />)

      await user.click(screen.getByText('today'))

      const readResult = () => ({
        plan: setPlan.mock.calls,
        taskUpdates: mutate.mock.calls,
      })
      expect(readResult()).toEqual({
        plan: [['day']],
        taskUpdates: [],
      })
    },
  )

  it.each([null, -1, 0, 1, 2] as const)(
    'clearing the plan does not change priority (%s)',
    async (priority) => {
      const { setPlan, mutate } = setUp('day')
      const user = userEvent.setup()
      render(<SidebarPlanField taskId={taskId} priority={priority} />)

      await user.click(screen.getByText('—'))

      const readResult = () => ({
        plan: setPlan.mock.calls,
        taskUpdates: mutate.mock.calls,
      })
      expect(readResult()).toEqual({
        plan: [['']],
        taskUpdates: [],
      })
    },
  )
})

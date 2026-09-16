import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SidebarPlanField } from '#components/task/sidebar-plan-field'
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
  it('selecting "today" upgrades an inbox task to active', async () => {
    const { setPlan, mutate } = setUp()
    const user = userEvent.setup()
    render(<SidebarPlanField taskId={taskId} commitment="inbox" />)

    await user.click(screen.getByText('today'))

    expect(setPlan).toHaveBeenCalledWith('day')
    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      input: { commitment: 'active' },
    })
  })

  it.each(['active', 'someday'] as const)(
    'selecting "today" does not change commitment when already %s',
    async (commitment) => {
      const { setPlan, mutate } = setUp()
      const user = userEvent.setup()
      render(<SidebarPlanField taskId={taskId} commitment={commitment} />)

      await user.click(screen.getByText('today'))

      expect(setPlan).toHaveBeenCalledWith('day')
      expect(mutate).not.toHaveBeenCalled()
    },
  )

  it.each(['inbox', 'active', 'someday'] as const)(
    'clearing the plan never changes commitment (%s)',
    async (commitment) => {
      const { setPlan, mutate } = setUp('day')
      const user = userEvent.setup()
      render(<SidebarPlanField taskId={taskId} commitment={commitment} />)

      await user.click(screen.getByText('—'))

      expect(setPlan).toHaveBeenCalledWith('')
      expect(mutate).not.toHaveBeenCalled()
    },
  )
})

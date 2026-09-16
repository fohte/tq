import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeProject } from '#components/project/project-test-fixtures'
import { SetProjectMenu } from '#components/task/set-project-menu'
import { useProjects } from '#hooks/use-projects'
import { useUpdateTask } from '#hooks/use-tasks'
import { mockMutateCallingOnSuccess, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...original,
    useProjects: vi.fn(),
  }
})

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useUpdateTask: vi.fn(),
  }
})

const mockUseProjects = vi.mocked(useProjects)
const mockUseUpdateTask = vi.mocked(useUpdateTask)

type ProjectsResult = ReturnType<typeof useProjects>
type UpdateTaskResult = ReturnType<typeof useUpdateTask>

const taskId = '00000000-0000-0000-0000-000000000001'
const taskNumber = 1

const projectA = makeProject({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
})
const projectB = makeProject({
  id: 'bbbb0000-0000-0000-0000-000000000000',
  title: 'Website redesign',
})

describe('SetProjectMenu', () => {
  it('updates the task project and closes the dialog on selection', async () => {
    mockUseProjects.mockReturnValue(
      partialMutation<ProjectsResult>({ data: [projectA, projectB] }),
    )
    const mutate = mockMutateCallingOnSuccess<UpdateTaskResult['mutate']>()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UpdateTaskResult>({ mutate }),
    )
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <SetProjectMenu
        open
        onOpenChange={onOpenChange}
        taskId={taskId}
        taskNumber={taskNumber}
      />,
    )

    await user.click(screen.getByText(projectB.title))

    expect(mutate).toHaveBeenCalledWith(
      { id: taskId, input: { projectId: projectB.id } },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

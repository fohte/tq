import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { makeProject } from '#components/project/project-test-fixtures'
import { SidebarProjectField } from '#components/task/sidebar-project-field'
import { useProjects } from '#hooks/use-projects'
import { useUpdateTask } from '#hooks/use-tasks'
import { clickSelectOption, partialMutation } from '#lib/test-utils'

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

type UseProjectsResult = ReturnType<typeof useProjects>
type UseUpdateTaskResult = ReturnType<typeof useUpdateTask>

const taskId = '00000000-0000-0000-0000-000000000001'

const projectA = makeProject({
  id: 'aaaa0000-0000-0000-0000-000000000000',
  title: 'tq',
})
const projectB = makeProject({
  id: 'bbbb0000-0000-0000-0000-000000000000',
  title: 'Website redesign',
})

describe('SidebarProjectField', () => {
  it('updates the task project when a project is picked', async () => {
    mockUseProjects.mockReturnValue(
      partialMutation<UseProjectsResult>({ data: [projectA, projectB] }),
    )
    const mutate = vi.fn()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(<SidebarProjectField taskId={taskId} projectId={null} />)

    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: projectB.title }),
    )

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      input: { projectId: projectB.id },
    })
  })

  it('resolves the "—" option to a null projectId', async () => {
    mockUseProjects.mockReturnValue(
      partialMutation<UseProjectsResult>({ data: [projectA, projectB] }),
    )
    const mutate = vi.fn()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UseUpdateTaskResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(<SidebarProjectField taskId={taskId} projectId={projectA.id} />)

    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: '—' }),
    )

    expect(mutate).toHaveBeenCalledWith({
      id: taskId,
      input: { projectId: null },
    })
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LinkExistingProjectTaskMenu } from '#components/project/link-existing-project-task-menu'
import { makeProject } from '#components/project/project-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { useProjects, useProjectTaskIds } from '#hooks/use-projects'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { useUpdateTask } from '#hooks/use-tasks'
import { mockMutateCallingOnSuccess, partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...original,
    useSearchTasks: vi.fn(),
  }
})

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...original,
    useProjects: vi.fn(),
    useProjectTaskIds: vi.fn(),
  }
})

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useUpdateTask: vi.fn(),
  }
})

const mockUseSearchTasks = vi.mocked(useSearchTasks)
const mockUseProjects = vi.mocked(useProjects)
const mockUseProjectTaskIds = vi.mocked(useProjectTaskIds)
const mockUseUpdateTask = vi.mocked(useUpdateTask)

type UpdateTaskResult = ReturnType<typeof useUpdateTask>

function mockSearchResults(data: SearchResult[]) {
  mockUseSearchTasks.mockReturnValue(
    partialMutation<ReturnType<typeof useSearchTasks>>({
      data,
      isFetching: false,
    }),
  )
}

const projectId = '00000000-0000-0000-0000-000000000001'
const projectTitle = 'ISUCON14'

const otherProject = makeProject({
  id: '00000000-0000-0000-0000-000000000099',
  title: 'Website Redesign',
})

const orphanCandidate: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000011',
  number: 12,
  title: 'Deploy to production',
})

const candidateWithProject: SearchResult = makeTask({
  id: '00000000-0000-0000-0000-000000000012',
  number: 34,
  title: 'Deploy docs site',
  projectId: otherProject.id,
})

describe('LinkExistingProjectTaskMenu', () => {
  beforeEach(() => {
    mockUseProjects.mockReturnValue(
      partialMutation<ReturnType<typeof useProjects>>({ data: [otherProject] }),
    )
    mockUseProjectTaskIds.mockReturnValue(
      partialMutation<ReturnType<typeof useProjectTaskIds>>({ data: [] }),
    )
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UpdateTaskResult>({ mutate: vi.fn() }),
    )
  })

  it('shows search results once a query is typed', async () => {
    mockSearchResults([orphanCandidate, candidateWithProject])
    const user = userEvent.setup()
    render(
      <LinkExistingProjectTaskMenu
        open
        onOpenChange={vi.fn()}
        projectId={projectId}
        projectTitle={projectTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('Deploy to production')).toBeInTheDocument()
    expect(screen.getByText('Deploy docs site')).toBeInTheDocument()
  })

  it('shows the confirm dialog when a candidate already belongs to a project', async () => {
    mockSearchResults([orphanCandidate, candidateWithProject])
    const user = userEvent.setup()
    render(
      <LinkExistingProjectTaskMenu
        open
        onOpenChange={vi.fn()}
        projectId={projectId}
        projectTitle={projectTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy docs site'))

    expect(screen.getByText('Move to this project?')).toBeInTheDocument()
    expect(
      screen.getByText(
        '#34 Deploy docs site currently belongs to Website Redesign. It will be moved to ISUCON14.',
      ),
    ).toBeInTheDocument()
  })

  it('moves an orphan candidate directly and closes without a confirm dialog', async () => {
    mockSearchResults([orphanCandidate])
    const mutate = mockMutateCallingOnSuccess<UpdateTaskResult['mutate']>()
    mockUseUpdateTask.mockReturnValue(
      partialMutation<UpdateTaskResult>({ mutate }),
    )
    const onOpenChange = vi.fn()
    const user = userEvent.setup()
    render(
      <LinkExistingProjectTaskMenu
        open
        onOpenChange={onOpenChange}
        projectId={projectId}
        projectTitle={projectTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText('Deploy to production'))

    expect(mutate).toHaveBeenCalledWith(
      { id: orphanCandidate.id, input: { projectId } },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- vitest's expect.any() return type isn't generic, so TS can only type this property as `any`
      { onSuccess: expect.any(Function) },
    )
    expect(screen.queryByText('Move to this project?')).not.toBeInTheDocument()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows a no-results message when the search returns nothing', async () => {
    mockSearchResults([])
    const user = userEvent.setup()
    render(
      <LinkExistingProjectTaskMenu
        open
        onOpenChange={vi.fn()}
        projectId={projectId}
        projectTitle={projectTitle}
      />,
    )

    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')

    expect(screen.getByText('no results for "Deploy"')).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { SidebarParentField } from '#components/task/sidebar-parent-field'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { useSearchTasks } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { partialMutation } from '#lib/test-utils'

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...original,
    useTaskList: vi.fn(),
    useUpdateTaskParent: vi.fn(),
  }
})

vi.mock('#hooks/use-search', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-search')>()
  return {
    ...original,
    useSearchTasks: vi.fn(),
  }
})

const mockUseTaskList = vi.mocked(useTaskList)
const mockUseUpdateTaskParent = vi.mocked(useUpdateTaskParent)
const mockUseSearchTasks = vi.mocked(useSearchTasks)

type UseTaskListResult = ReturnType<typeof useTaskList>
type UseUpdateTaskParentResult = ReturnType<typeof useUpdateTaskParent>
type UseSearchTasksResult = ReturnType<typeof useSearchTasks>

const currentTask = makeTask({
  id: 'task-1',
  number: 1,
  title: 'Current task',
})

const existingParentTask = makeTask({
  id: 'task-2',
  number: 5,
  title: 'Existing parent',
})

const searchCandidate = makeTask({
  id: 'task-3',
  number: 20,
  title: 'Deploy to production',
})

describe('SidebarParentField', () => {
  it('opens the popup and shows the search input when the closed label is clicked', async () => {
    mockUseTaskList.mockReturnValue(
      partialMutation<UseTaskListResult>({
        categorized: { all: [currentTask] },
      }),
    )
    mockUseSearchTasks.mockReturnValue(
      partialMutation<UseSearchTasksResult>({ data: [], isFetching: false }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UseUpdateTaskParentResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(<SidebarParentField taskId={currentTask.id} parentId={null} />)

    await user.click(screen.getByRole('button', { name: '—' }))

    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument()
  })

  it('selects a candidate and updates the parent', async () => {
    const mutate = vi.fn()
    mockUseTaskList.mockReturnValue(
      partialMutation<UseTaskListResult>({
        categorized: { all: [currentTask] },
      }),
    )
    mockUseSearchTasks.mockReturnValue(
      partialMutation<UseSearchTasksResult>({
        data: [searchCandidate],
        isFetching: false,
      }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UseUpdateTaskParentResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(<SidebarParentField taskId={currentTask.id} parentId={null} />)

    await user.click(screen.getByRole('button', { name: '—' }))
    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText(searchCandidate.title))

    expect(mutate).toHaveBeenCalledWith({
      id: currentTask.id,
      parentId: searchCandidate.id,
    })
  })

  it('closes the popup after selecting a candidate', async () => {
    mockUseTaskList.mockReturnValue(
      partialMutation<UseTaskListResult>({
        categorized: { all: [currentTask] },
      }),
    )
    mockUseSearchTasks.mockReturnValue(
      partialMutation<UseSearchTasksResult>({
        data: [searchCandidate],
        isFetching: false,
      }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UseUpdateTaskParentResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(<SidebarParentField taskId={currentTask.id} parentId={null} />)

    await user.click(screen.getByRole('button', { name: '—' }))
    await user.type(screen.getByPlaceholderText('Search tasks...'), 'Deploy')
    await user.click(screen.getByText(searchCandidate.title))

    expect(screen.queryByPlaceholderText('Search tasks...')).toBeNull()
  })

  it('clears the parent when the "—" row is clicked', async () => {
    const mutate = vi.fn()
    mockUseTaskList.mockReturnValue(
      partialMutation<UseTaskListResult>({
        categorized: { all: [currentTask, existingParentTask] },
      }),
    )
    mockUseSearchTasks.mockReturnValue(
      partialMutation<UseSearchTasksResult>({ data: [], isFetching: false }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UseUpdateTaskParentResult>({ mutate }),
    )
    const user = userEvent.setup()
    render(
      <SidebarParentField
        taskId={currentTask.id}
        parentId={existingParentTask.id}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `#${String(existingParentTask.number)} ${existingParentTask.title}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: '—' }))

    expect(mutate).toHaveBeenCalledWith({
      id: currentTask.id,
      parentId: null,
    })
  })

  it('closes the popup after clearing the parent', async () => {
    mockUseTaskList.mockReturnValue(
      partialMutation<UseTaskListResult>({
        categorized: { all: [currentTask, existingParentTask] },
      }),
    )
    mockUseSearchTasks.mockReturnValue(
      partialMutation<UseSearchTasksResult>({ data: [], isFetching: false }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UseUpdateTaskParentResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(
      <SidebarParentField
        taskId={currentTask.id}
        parentId={existingParentTask.id}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: `#${String(existingParentTask.number)} ${existingParentTask.title}`,
      }),
    )
    await user.click(screen.getByRole('button', { name: '—' }))

    expect(screen.queryByPlaceholderText('Search tasks...')).toBeNull()
  })

  it('excludes the current task and its descendants from candidates', async () => {
    const childTask = makeTask({
      id: 'task-4',
      number: 2,
      title: 'Child task',
      parentId: currentTask.id,
      parentNumber: currentTask.number,
    })
    const grandchildTask = makeTask({
      id: 'task-5',
      number: 3,
      title: 'Grandchild task',
      parentId: childTask.id,
      parentNumber: childTask.number,
    })
    const unrelatedTask = makeTask({
      id: 'task-6',
      number: 4,
      title: 'Unrelated task',
    })

    mockUseTaskList.mockReturnValue(
      partialMutation<UseTaskListResult>({
        categorized: {
          all: [currentTask, childTask, grandchildTask, unrelatedTask],
        },
      }),
    )
    mockUseSearchTasks.mockReturnValue(
      partialMutation<UseSearchTasksResult>({
        data: [currentTask, childTask, grandchildTask, unrelatedTask],
        isFetching: false,
      }),
    )
    mockUseUpdateTaskParent.mockReturnValue(
      partialMutation<UseUpdateTaskParentResult>({ mutate: vi.fn() }),
    )
    const user = userEvent.setup()
    render(<SidebarParentField taskId={currentTask.id} parentId={null} />)

    await user.click(screen.getByRole('button', { name: '—' }))
    await user.type(screen.getByPlaceholderText('Search tasks...'), 'task')

    expect(
      screen
        .getAllByRole('button', { name: /^#\d+ / })
        .map((el) => el.textContent),
    ).toEqual([`#${String(unrelatedTask.number)}${unrelatedTask.title}`])
  })
})

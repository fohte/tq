import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Task } from '#hooks/use-tasks'
import { TodayFocus } from '#routes/today'

const mockUseTaskList = vi.fn()
const mockUseTodayTasks = vi.fn()
const mockUseSetTodayTasks = vi.fn()

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useTaskList: (...args: unknown[]) => mockUseTaskList(...args),
  }
})

vi.mock('#hooks/use-today-tasks', () => ({
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useTodayTasks: (...args: unknown[]) => mockUseTodayTasks(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useSetTodayTasks: (...args: unknown[]) => mockUseSetTodayTasks(...args),
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    number: 1,
    title: 'Task 1',
    description: null,
    status: 'todo',
    context: 'work',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

function setup({
  all,
  queue,
  isLoading = false,
  isTodayTasksLoading = false,
}: {
  all: Task[]
  queue: Task[]
  isLoading?: boolean
  isTodayTasksLoading?: boolean
}) {
  mockUseTaskList.mockReturnValue({ isLoading, categorized: { all } })
  mockUseTodayTasks.mockReturnValue({
    data: queue.map((t) => ({ taskId: t.id })),
    isLoading: isTodayTasksLoading,
  })
  const mutate = vi.fn()
  mockUseSetTodayTasks.mockReturnValue({ mutate, isPending: false })
  return { mutate }
}

function renderToday() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const buildTree = () => (
    <QueryClientProvider client={queryClient}>
      <TodayFocus />
    </QueryClientProvider>
  )
  const utils = render(buildTree())
  return {
    ...utils,
    rerender: () => {
      utils.rerender(buildTree())
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-03-20T09:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('TodayFocus', () => {
  it('focuses the first non-completed task in queue order', () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    renderToday()

    expect(screen.getByText('Task A')).toBeInTheDocument()
  })

  it('skips completed tasks when selecting the focus task', () => {
    const taskA = makeTask({ id: 'a', title: 'Task A', status: 'completed' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    renderToday()

    expect(screen.getByText('Task B')).toBeInTheDocument()
  })

  it('shows the next non-completed task as the next task preview', () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    renderToday()

    expect(screen.getByText('UP NEXT')).toBeInTheDocument()
    expect(screen.getByText('Task B')).toBeInTheDocument()
  })

  it('shows subtasks of the focus task as a checklist', () => {
    const parent = makeTask({ id: 'parent', title: 'Parent task' })
    const child = makeTask({
      id: 'child',
      title: 'Child task',
      parentId: 'parent',
    })
    setup({ all: [parent, child], queue: [parent] })

    renderToday()

    expect(screen.getByText('Child task')).toBeInTheDocument()
  })

  it("shows the empty queue state when today's queue is empty", () => {
    setup({ all: [], queue: [] })

    renderToday()

    expect(screen.getByText("No tasks in today's queue")).toBeInTheDocument()
  })

  it('shows the all-done state when every queued task is completed', () => {
    const taskA = makeTask({ id: 'a', title: 'Task A', status: 'completed' })
    setup({ all: [taskA], queue: [taskA] })

    renderToday()

    expect(
      screen.getByText('All tasks completed for today'),
    ).toBeInTheDocument()
  })

  it('shows a loading spinner while tasks are loading', () => {
    setup({ all: [], queue: [], isLoading: true })

    renderToday()

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it("shows a loading spinner while today's queue is still loading even after the task list finishes", () => {
    setup({ all: [], queue: [], isLoading: false, isTodayTasksLoading: true })

    renderToday()

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('moves focus to the next task once the current task is completed', () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    const { rerender } = renderToday()
    expect(screen.getByText('Task A')).toBeInTheDocument()

    const completedTaskA: Task = { ...taskA, status: 'completed' }
    setup({
      all: [completedTaskA, taskB],
      queue: [completedTaskA, taskB],
    })
    rerender()

    expect(screen.getByText('Task B')).toBeInTheDocument()
    expect(screen.queryByText('UP NEXT')).not.toBeInTheDocument()
  })

  it('removes the focus task from today when defer is clicked', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    const { mutate } = setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    renderToday()
    vi.useRealTimers()
    const user = userEvent.setup()
    await user.click(screen.getByText('defer'))

    expect(mutate).toHaveBeenCalledWith({
      date: '2026-03-20',
      taskIds: ['b'],
    })
  })

  it('moves focus to the next task once the current task leaves the queue', () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    const { rerender } = renderToday()
    expect(screen.getByText('Task A')).toBeInTheDocument()

    setup({ all: [taskA, taskB], queue: [taskB] })
    rerender()

    expect(screen.getByText('Task B')).toBeInTheDocument()
    expect(screen.queryByText('Task A')).not.toBeInTheDocument()
  })
})

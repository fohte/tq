import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Task } from '#hooks/use-tasks'
import { TodayFocus } from '#routes/today'

const mockUseTaskList = vi.fn()
const mockUseQueueItems = vi.fn()
const mockUseSetQueueItems = vi.fn()

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
    useTaskList: (...args: unknown[]) => mockUseTaskList(...args),
  }
})

vi.mock('#hooks/use-queues', () => ({
  DAY_QUEUE_KEY: 'day',
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useQueueItems: (...args: unknown[]) => mockUseQueueItems(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useSetQueueItems: (...args: unknown[]) => mockUseSetQueueItems(...args),
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    number: 1,
    title: 'Task 1',
    description: null,
    status: 'todo',
    statusReason: null,
    duplicateOfNumber: null,
    blockedByNumbers: [],
    context: 'work',
    commitment: 'active',
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    githubLinks: [],
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
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
  mockUseQueueItems.mockReturnValue({
    data: queue.map((t) => ({ taskId: t.id })),
    isLoading: isTodayTasksLoading,
  })
  const mutate = vi.fn()
  mockUseSetQueueItems.mockReturnValue({ mutate, isPending: false })
  return { mutate }
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
// A fresh router (re-loaded) is built for both the initial render and every
// rerender — TanStack Router memoizes matched-route rendering on unchanged
// router state, so reusing one router across rerenders would keep stale
// mock data on screen.
async function buildTree(queryClient: QueryClient) {
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
    component: () => (
      <QueryClientProvider client={queryClient}>
        <TodayFocus />
      </QueryClientProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return <RouterProvider router={router} />
}

async function renderToday() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const utils = render(await buildTree(queryClient))
  return {
    ...utils,
    rerender: async () => {
      utils.rerender(await buildTree(queryClient))
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
  it('focuses the first non-completed task in queue order', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    await renderToday()

    expect(screen.getByText('Task A')).toBeInTheDocument()
  })

  it('skips completed tasks when selecting the focus task', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A', status: 'completed' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    await renderToday()

    expect(screen.getByText('Task B')).toBeInTheDocument()
  })

  it('shows the next non-completed task as the next task preview', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    await renderToday()

    expect(screen.getByText('UP NEXT')).toBeInTheDocument()
    expect(screen.getByText('Task B')).toBeInTheDocument()
  })

  it('shows subtasks of the focus task as a checklist', async () => {
    const parent = makeTask({ id: 'parent', title: 'Parent task' })
    const child = makeTask({
      id: 'child',
      title: 'Child task',
      parentId: 'parent',
    })
    setup({ all: [parent, child], queue: [parent] })

    await renderToday()

    expect(screen.getByText('Child task')).toBeInTheDocument()
  })

  it("shows the empty queue state when today's queue is empty", async () => {
    setup({ all: [], queue: [] })

    await renderToday()

    expect(screen.getByText("No tasks in today's queue")).toBeInTheDocument()
  })

  it('shows the all-done state when every queued task is completed', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A', status: 'completed' })
    setup({ all: [taskA], queue: [taskA] })

    await renderToday()

    expect(
      screen.getByText('All tasks completed for today'),
    ).toBeInTheDocument()
  })

  it('shows a loading spinner while tasks are loading', async () => {
    setup({ all: [], queue: [], isLoading: true })

    await renderToday()

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it("shows a loading spinner while today's queue is still loading even after the task list finishes", async () => {
    setup({ all: [], queue: [], isLoading: false, isTodayTasksLoading: true })

    await renderToday()

    expect(document.querySelector('.animate-spin')).toBeTruthy()
  })

  it('moves focus to the next task once the current task is completed', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    const { rerender } = await renderToday()
    expect(screen.getByText('Task A')).toBeInTheDocument()

    const completedTaskA: Task = { ...taskA, status: 'completed' }
    setup({
      all: [completedTaskA, taskB],
      queue: [completedTaskA, taskB],
    })
    await rerender()

    expect(screen.getByText('Task B')).toBeInTheDocument()
    expect(screen.queryByText('UP NEXT')).not.toBeInTheDocument()
  })

  it('removes the focus task from today when defer is clicked', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    const { mutate } = setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    await renderToday()
    vi.useRealTimers()
    const user = userEvent.setup()
    await user.click(screen.getByText('defer'))

    expect(mutate).toHaveBeenCalledWith({
      key: 'day',
      date: '2026-03-20',
      taskIds: ['b'],
    })
  })

  it('moves focus to the next task once the current task leaves the queue', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    const { rerender } = await renderToday()
    expect(screen.getByText('Task A')).toBeInTheDocument()

    setup({ all: [taskA, taskB], queue: [taskB] })
    await rerender()

    expect(screen.getByText('Task B')).toBeInTheDocument()
    expect(screen.queryByText('Task A')).not.toBeInTheDocument()
  })
})

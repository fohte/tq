import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { makeTask as makeBaseTask } from '#components/task/task-row-test-fixtures'
import type { Task, TaskListFilter } from '#hooks/use-tasks'
import { TodayFocus } from '#routes/today'

type TaskListOptions = {
  enabled?: boolean
  placeholderData?: (
    previousData: Task[] | undefined,
    previousFilter: TaskListFilter | undefined,
  ) => Task[] | undefined
}

type QueueItemsOptions = { enabled?: boolean; context?: Task['context'] }
type QueueItem = { taskId: string; sortOrder: number }

const mockUseTaskList = vi.fn<
  (
    filter: TaskListFilter,
    options?: TaskListOptions,
  ) => {
    data?: Task[]
    isLoading: boolean
    isPlaceholderData: boolean
    isError: boolean
  }
>()
const mockUseCurrentContext = vi.fn<() => Task['context']>()
const mockUseQueueCarryOver = vi.fn<(date: string) => unknown>()
const mockUseQueueItems =
  vi.fn<
    (
      key: string,
      date: string,
      options?: QueueItemsOptions,
    ) => { data: QueueItem[]; isLoading: boolean }
  >()
const mockUseSetQueueItems = vi.fn()

vi.mock('#hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('#hooks/use-tasks')>()
  return {
    ...actual,
    useTaskList: (...args: Parameters<typeof mockUseTaskList>) =>
      mockUseTaskList(...args),
  }
})

vi.mock('#hooks/use-current-context', () => ({
  useCurrentContext: () => mockUseCurrentContext(),
}))

vi.mock('#hooks/use-queues', () => ({
  DAY_QUEUE_KEY: 'day',
  useQueueCarryOver: (date: string) => mockUseQueueCarryOver(date),
  useQueueItems: (...args: Parameters<typeof mockUseQueueItems>) =>
    mockUseQueueItems(...args),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- mock delegation
  useSetQueueItems: (...args: unknown[]) => mockUseSetQueueItems(...args),
}))

function makeTask(overrides: Partial<Task> = {}): Task {
  return makeBaseTask({
    id: 'task-1',
    title: 'Task 1',
    context: 'work',
    ...overrides,
  })
}

function focusTransition(before: string | null, after: string | null) {
  return { before, after }
}

function todayTaskRequestSnapshot(
  taskQueries: unknown[],
  queueOptions: QueueItemsOptions | undefined,
) {
  return { taskQueries, queueOptions }
}

function setup({
  all,
  queue,
  queueSortOrders = queue.map((_, index) => index),
  context = 'work',
  isLoading = false,
  isSubtasksLoading = false,
  subtasksError = false,
  isTodayTasksLoading = false,
}: {
  all: Task[]
  queue: Task[]
  queueSortOrders?: number[]
  context?: Task['context']
  isLoading?: boolean
  isSubtasksLoading?: boolean
  subtasksError?: boolean
  isTodayTasksLoading?: boolean
}) {
  mockUseCurrentContext.mockReturnValue(context)
  mockUseTaskList.mockImplementation(
    (filter: TaskListFilter, options?: TaskListOptions) => {
      const tasks = all.filter((task) => {
        if (task.context !== filter.context) {
          return false
        }
        if (filter.ids != null) return filter.ids.includes(task.id)
        if (filter.parentId != null) return task.parentId === filter.parentId
        return false
      })
      return {
        data: tasks,
        isLoading:
          options?.enabled !== false &&
          ((filter.ids != null && isLoading) ||
            (filter.parentId != null && isSubtasksLoading)),
        isPlaceholderData: false,
        isError: filter.parentId != null && subtasksError,
      }
    },
  )
  mockUseQueueCarryOver.mockReturnValue({
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    isCarryingOver: false,
    canReadQueueItems: true,
  })
  mockUseQueueItems.mockImplementation((_key, _date, options) => ({
    data: queue.flatMap((task, index) =>
      task.context === options?.context
        ? [{ taskId: task.id, sortOrder: queueSortOrders[index] ?? index }]
        : [],
    ),
    isLoading: isTodayTasksLoading,
  }))
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
  it('waits for carry-over before reading today queue items', async () => {
    setup({ all: [], queue: [], isTodayTasksLoading: true })
    mockUseQueueCarryOver.mockReturnValue({
      isSuccess: false,
      isPending: true,
      isError: false,
      error: null,
      isCarryingOver: true,
      canReadQueueItems: false,
    })

    await renderToday()

    const getOutput = () => [
      mockUseQueueCarryOver.mock.calls.map(([date]) => date),
      mockUseQueueItems.mock.calls,
    ]
    expect(getOutput()).toEqual([
      ['2026-03-20'],
      [['day', '2026-03-20', { enabled: false, context: 'work' }]],
    ])
  })

  it('reads today queue items if carry-over fails', async () => {
    setup({ all: [], queue: [] })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockUseQueueCarryOver.mockReturnValue({
      isSuccess: false,
      isPending: false,
      isError: true,
      error: new Error('carry-over unavailable'),
      isCarryingOver: false,
      canReadQueueItems: true,
    })

    await renderToday()

    expect(mockUseQueueItems.mock.calls).toEqual([
      ['day', '2026-03-20', { enabled: true, context: 'work' }],
    ])
  })

  it('carries over each local today before reading its day queue', async () => {
    setup({ all: [], queue: [] })

    await renderToday()

    await act(async () => {
      vi.setSystemTime(new Date('2026-03-21T09:00:00'))
      await vi.advanceTimersByTimeAsync(60_000)
    })

    const getOutput = () => [
      mockUseQueueCarryOver.mock.calls.map(([date]) => date),
      mockUseQueueItems.mock.calls,
    ]
    expect(getOutput()).toEqual([
      ['2026-03-20', '2026-03-21'],
      [
        ['day', '2026-03-20', { enabled: true, context: 'work' }],
        ['day', '2026-03-21', { enabled: true, context: 'work' }],
      ],
    ])
  })

  it('fetches only current-context queue tasks and subtasks of the focus task', async () => {
    const focus = makeTask({ id: 'focus', title: 'Focus task' })
    const next = makeTask({ id: 'next', title: 'Next task' })
    const otherContext = makeTask({
      id: 'other-context',
      context: 'personal',
      title: 'Other context task',
    })
    const child = makeTask({ id: 'child', parentId: 'focus' })
    setup({
      all: [focus, next, otherContext, child],
      queue: [focus, next, otherContext],
    })

    await renderToday()

    const taskQueries = mockUseTaskList.mock.calls.map(([filter, options]) => ({
      filter,
      enabled: options?.enabled,
      hasPlaceholderData: options?.placeholderData != null,
    }))
    expect(
      todayTaskRequestSnapshot(
        taskQueries,
        mockUseQueueItems.mock.calls[0]?.[2],
      ),
    ).toEqual({
      taskQueries: [
        {
          filter: {
            ids: ['focus', 'next'],
            context: 'work',
            status: 'all',
            limit: 'unlimited',
          },
          enabled: true,
          hasPlaceholderData: true,
        },
        {
          filter: {
            parentId: 'focus',
            context: 'work',
            status: 'all',
            limit: 'unlimited',
          },
          enabled: true,
          hasPlaceholderData: false,
        },
      ],
      queueOptions: { enabled: true, context: 'work' },
    })
  })

  it('passes the selected context to queue and task queries', async () => {
    const focus = makeTask({ id: 'focus', context: 'personal' })
    const child = makeTask({
      id: 'child',
      context: 'personal',
      parentId: 'focus',
    })
    const otherContext = makeTask({ id: 'other-context', context: 'work' })
    setup({
      all: [focus, child, otherContext],
      queue: [focus, otherContext],
      context: 'personal',
    })

    await renderToday()

    const taskQueries = mockUseTaskList.mock.calls.map(([filter, options]) => ({
      filter,
      enabled: options?.enabled,
    }))
    expect(
      todayTaskRequestSnapshot(
        taskQueries,
        mockUseQueueItems.mock.calls[0]?.[2],
      ),
    ).toEqual({
      taskQueries: [
        {
          filter: {
            ids: ['focus'],
            context: 'personal',
            status: 'all',
            limit: 'unlimited',
          },
          enabled: true,
        },
        {
          filter: {
            parentId: 'focus',
            context: 'personal',
            status: 'all',
            limit: 'unlimited',
          },
          enabled: true,
        },
      ],
      queueOptions: { enabled: true, context: 'personal' },
    })
  })

  it('focuses the first non-completed task in queue order', async () => {
    const taskA = makeTask({ id: 'a', title: 'Task A' })
    const taskB = makeTask({ id: 'b', title: 'Task B' })
    setup({ all: [taskA, taskB], queue: [taskA, taskB] })

    await renderToday()

    expect(screen.getByText('Task A')).toBeInTheDocument()
  })

  it('focuses the task with the earliest due date before undated tasks', async () => {
    const undated = makeTask({ id: 'undated', title: 'Undated task' })
    const later = makeTask({
      id: 'later',
      title: 'Later task',
      dueDate: '2026-03-22',
    })
    const earlier = makeTask({
      id: 'earlier',
      title: 'Earlier task',
      dueDate: '2026-03-21',
    })
    setup({ all: [undated, later, earlier], queue: [undated, later, earlier] })

    await renderToday()

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Earlier task',
    )
  })

  it('keeps sortOrder as the tie-break when a due date changes without queue refetch', async () => {
    const taskA = makeTask({
      id: 'a',
      title: 'Task A',
      dueDate: '2026-03-22',
    })
    const taskB = makeTask({
      id: 'b',
      title: 'Task B',
      dueDate: '2026-03-21',
    })
    setup({
      all: [taskA, taskB],
      queue: [taskB, taskA],
      queueSortOrders: [1, 0],
    })

    const { rerender } = await renderToday()
    const focusBeforeUpdate = screen.getByRole('heading', {
      level: 1,
    }).textContent
    const updatedTaskA = { ...taskA, dueDate: '2026-03-21' }
    setup({
      all: [updatedTaskA, taskB],
      queue: [taskB, updatedTaskA],
      queueSortOrders: [1, 0],
    })
    await rerender()

    const focusAfterUpdate = screen.getByRole('heading', {
      level: 1,
    }).textContent

    expect(focusTransition(focusBeforeUpdate, focusAfterUpdate)).toEqual({
      before: 'Task B',
      after: 'Task A',
    })
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

    const getOutput = () => ({
      taskQueries: mockUseTaskList.mock.calls.map(([filter, options]) => ({
        filter,
        enabled: options?.enabled,
      })),
      queueOptions: mockUseQueueItems.mock.calls[0]?.[2],
      emptyMessage: screen.getByText("No tasks in today's queue").textContent,
    })
    expect(getOutput()).toEqual({
      taskQueries: [
        {
          filter: {
            ids: [],
            context: 'work',
            status: 'all',
            limit: 'unlimited',
          },
          enabled: false,
        },
        {
          filter: { context: 'work', status: 'all', limit: 'unlimited' },
          enabled: false,
        },
      ],
      queueOptions: { enabled: true, context: 'work' },
      emptyMessage: "No tasks in today's queue",
    })
  })

  it('keeps the focus task visible while its subtasks are loading', async () => {
    const focus = makeTask({ id: 'focus', title: 'Focus task' })
    setup({ all: [focus], queue: [focus], isSubtasksLoading: true })

    await renderToday()

    const getOutput = () => ({
      focusTitle: screen.getByRole('heading', { level: 1 }).textContent,
      loadingIndicators: document.querySelectorAll('.animate-spin').length,
    })
    expect(getOutput()).toEqual({
      focusTitle: 'Focus task',
      loadingIndicators: 0,
    })
  })

  it('shows a subtask load failure without hiding the focus task', async () => {
    const focus = makeTask({ id: 'focus', title: 'Focus task' })
    setup({ all: [focus], queue: [focus], subtasksError: true })

    await renderToday()

    const getOutput = () => ({
      focusTitle: screen.getByRole('heading', { level: 1 }).textContent,
      subtaskError: screen.getByRole('alert').textContent,
    })
    expect(getOutput()).toEqual({
      focusTitle: 'Focus task',
      subtaskError: 'Failed to load subtasks.',
    })
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
    const queuedTask = makeTask({ id: 'queued', title: 'Queued task' })
    setup({ all: [], queue: [queuedTask], isLoading: true })

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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CalendarDndCallbacks } from '#components/calendar/calendar-grid'
import type { TimeBlockEvent } from '#components/calendar/calendar-view'
import type { QueueSectionData } from '#components/day-view/queue-pane'
import { makeQueueSectionData } from '#components/day-view/queue-pane-test-fixtures'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import {
  makeQueueCandidate,
  makeTask,
} from '#components/task/task-row-test-fixtures'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { makeQueue } from '#hooks/queue-test-fixtures'
import type { QueueItem } from '#hooks/use-queues'
import type { Task } from '#hooks/use-tasks'
import { getNowPanelQueryDateRange } from '#lib/compact-layout'
import { formatLocalDate } from '#lib/date-range'
import type { QueueCandidate } from '#lib/queue-candidates'
import { formatShortDate } from '#lib/task-due-date'
import { assertDefined } from '#lib/test-utils'
import { Route as RootRoute } from '#routes/__root'
import { Route as DayRoute } from '#routes/index'

type TaskListMock = (
  filter: unknown,
  options?: { enabled?: boolean; placeholderData?: unknown },
) => unknown
type DateRangeQueryMock = (
  startDate: string,
  endDate: string,
  enabled?: boolean,
) => unknown
type GcalQueryMock = (
  startDate: string,
  endDate: string,
  context: 'work' | 'personal',
  enabled?: boolean,
) => unknown
type QueueListMock = () => unknown
type QueueItemsMock = (
  queues: unknown,
  date: string,
  options?: { enabled?: boolean },
) => unknown
type QueueCarryOverMock = (date: string) => {
  isSuccess: boolean
  isPending: boolean
  isError: boolean
  error: unknown
  isCarryingOver: boolean
  canReadQueueItems: boolean
}
type QueueRangeMock = (
  key: string,
  from: string,
  to: string,
  options?: { enabled?: boolean },
) => {
  data: QueueItem[] | undefined
  error: unknown
  errorUpdatedAt: number
}
type QueueTransitionTaskData = {
  candidateTasks: Task[] | undefined
  dateTasks: Task[] | undefined
  referencedTasks: {
    data: Task[] | undefined
    isPlaceholderData: boolean
    error: unknown
  }
  candidateError?: unknown
  dateError?: unknown
}
type QueueTransitionQueueResult = {
  data: QueueItem[] | undefined
  error: unknown
}
type QueueTransitionRangeResult = {
  data: QueueItem[] | undefined
  error: unknown
  errorUpdatedAt: number
}
type TaskMapMock = (tasks: Task[]) => ReadonlyMap<string, Task>
type QueueMutationVariables = {
  key: string
  date: string
  taskIds: string[]
}
type QueueMutationOptions = {
  onSuccess?: () => void
  onError?: (error: unknown) => void
}
type DayViewMockProps = {
  layout?: string
  isLoading?: boolean
  isQueueRefreshing?: boolean
  calendarEvents?: TimeBlockEvent[]
  dayQueueTasks?: Task[]
  nowPanel?: { isLoading?: boolean }
  onVisibleRangeChange?: (range: { start: Date; end: Date }) => void
  dndCallbacks?: CalendarDndCallbacks
  queueSections?: QueueSectionData[]
  queueCandidates?: QueueCandidate<Task>[]
  onAddCandidate?: (taskId: string) => void
  onInsertCandidate?: (queueKey: string, taskId: string) => void
  onRemoveFromQueue?: (queueKey: string, taskId: string) => void
  onMoveTask?: (
    taskId: string,
    fromQueueKey: string,
    toQueueKey: string,
  ) => void
  onMoveScheduledTaskToWeek?: (taskId: string, date: string) => void
}
type MemosMock = (
  context: 'work' | 'personal',
  enabled: boolean,
) => {
  data: undefined
  error: unknown
  isPending: boolean
  isError: boolean
}

function isTaskListFilterWith(
  filter: unknown,
  field: string,
): filter is Record<string, unknown> {
  return typeof filter === 'object' && filter !== null && field in filter
}

function isDueTaskQuery(filter: unknown): boolean {
  return isTaskListFilterWith(filter, 'dueTo')
}

function getEnabledTaskListFilters(): unknown[] {
  const filters = new Map<string, unknown>()
  mocks.useTaskList.mock.calls
    .filter(([, options]) => options?.enabled !== false)
    .forEach(([filter]) => {
      const key = isTaskListFilterWith(filter, 'ids')
        ? 'ids'
        : isTaskListFilterWith(filter, 'candidatesOn')
          ? 'candidatesOn'
          : isTaskListFilterWith(filter, 'dateFrom') ||
              isTaskListFilterWith(filter, 'dateTo')
            ? 'dateRange'
            : JSON.stringify(filter)
      filters.set(key, filter)
    })
  return [...filters.values()]
}

function taskListQuerySnapshot(
  activeFilters: unknown[],
  idQueryOptions: Parameters<TaskListMock>[1],
) {
  return {
    activeFilters,
    idQueryOptions:
      idQueryOptions == null
        ? undefined
        : {
            enabled: idQueryOptions.enabled,
            hasPlaceholderData:
              typeof idQueryOptions.placeholderData === 'function',
          },
  }
}

const mocks = vi.hoisted(() => {
  let context: 'work' | 'personal' = 'work'

  return {
    useTaskList: vi.fn<TaskListMock>(),
    useTimeBlocks: vi.fn<DateRangeQueryMock>(),
    useScheduleList: vi.fn<DateRangeQueryMock>(),
    useGcalEvents: vi.fn<GcalQueryMock>(),
    useMemos: vi.fn<MemosMock>(),
    useQueues: vi.fn<QueueListMock>(),
    useQueueItemsForQueues: vi.fn<QueueItemsMock>(),
    useQueueCarryOver: vi.fn<QueueCarryOverMock>(),
    selectedDate: null as Date | null,
    get context() {
      return context
    },
    set context(value: 'work' | 'personal') {
      context = value
    },
    revision: 0,
    listeners: new Set<() => void>(),
    queueTransitionTaskData: new Map<string, QueueTransitionTaskData>(),
    queueTransitionItems: new Map<string, QueueTransitionQueueResult[]>(),
    queueTransitionRanges: new Map<string, QueueTransitionRangeResult>(),
    useQueueItemsForRange: vi.fn<QueueRangeMock>(),
    useTaskMap: vi.fn<TaskMapMock>(),
    fetchQueueItems:
      vi.fn<(key: string, date: string) => Promise<QueueItem[]>>(),
    setQueueItems:
      vi.fn<
        (
          variables: QueueMutationVariables,
          options?: QueueMutationOptions,
        ) => void
      >(),
    createTimeBlock: vi.fn<(input: unknown) => void>(),
    dayViewProps: vi.fn<(props: DayViewMockProps) => void>(),
  }
})

function notifyRouteMockChanges() {
  mocks.revision += 1
  mocks.listeners.forEach((listener) => {
    listener()
  })
}

function queueTransitionScopeKey(
  date: string,
  context: 'work' | 'personal' = mocks.context,
) {
  return `${context}:${date}`
}

function configureQueueTransitionMocks() {
  mocks.useTaskList.mockImplementation((filter, options) => {
    const date = formatLocalDate(
      mocks.selectedDate ?? new Date('2026-07-20T00:00:00'),
    )
    const taskData = mocks.queueTransitionTaskData.get(
      queueTransitionScopeKey(date),
    )

    if (isTaskListFilterWith(filter, 'candidatesOn')) {
      const queryDate = filter['candidatesOn']
      const state =
        typeof queryDate === 'string'
          ? mocks.queueTransitionTaskData.get(
              queueTransitionScopeKey(queryDate),
            )
          : undefined
      const error = state?.candidateError ?? null
      return {
        data: state?.candidateTasks,
        isLoading:
          options?.enabled !== false &&
          state?.candidateTasks === undefined &&
          error == null,
        error,
      }
    }

    if (isTaskListFilterWith(filter, 'dateFrom')) {
      const queryDate = filter['dateFrom']
      const state =
        typeof queryDate === 'string'
          ? mocks.queueTransitionTaskData.get(
              queueTransitionScopeKey(queryDate),
            )
          : undefined
      const error = state?.dateError ?? null
      return {
        data: state?.dateTasks,
        isLoading:
          options?.enabled !== false &&
          state?.dateTasks === undefined &&
          error == null,
        error,
      }
    }

    if (isTaskListFilterWith(filter, 'ids')) {
      const referencedTasks = taskData?.referencedTasks
      const error = referencedTasks?.error ?? null
      return {
        data: referencedTasks?.data,
        isLoading:
          options?.enabled !== false &&
          referencedTasks?.data === undefined &&
          error == null,
        isPlaceholderData: referencedTasks?.isPlaceholderData ?? false,
        error,
      }
    }

    if (isTaskListFilterWith(filter, 'dueTo')) {
      return { data: [], isLoading: false, error: null }
    }

    return { data: [], isLoading: false, error: null }
  })
  mocks.useQueueItemsForQueues.mockImplementation(
    (_queues, date) => mocks.queueTransitionItems.get(date) ?? [],
  )
  mocks.useQueueItemsForRange.mockImplementation(
    (_key, from, to) =>
      mocks.queueTransitionRanges.get(`${from}:${to}`) ?? {
        data: [],
        error: null,
        errorUpdatedAt: 0,
      },
  )
}

function readQueueTransitionOutput() {
  const props = assertDefined(mocks.dayViewProps.mock.lastCall?.[0])
  return {
    isLoading: props.isLoading ?? false,
    isQueueRefreshing: props.isQueueRefreshing ?? false,
    nowPanelLoading: props.nowPanel?.isLoading ?? false,
    queueSections: props.queueSections,
    dayQueueTasks: props.dayQueueTasks,
    queueCandidates: props.queueCandidates,
  }
}

function readQueueTransitionInteractionResult(revertCalendarQueueDrop: {
  mock: { calls: unknown[][] }
}) {
  return {
    mutationCalls: mocks.setQueueItems.mock.calls,
    calendarQueueDropReverted: revertCalendarQueueDrop.mock.calls,
  }
}

function makeExpectedQueueTransitionOutput({
  date,
  dayQueueTask,
  candidate,
  isLoading = false,
  isQueueRefreshing = false,
  nowPanelLoading = false,
  compact = true,
}: {
  date: string
  dayQueueTask?: Task
  candidate?: Task
  isLoading?: boolean
  isQueueRefreshing?: boolean
  nowPanelLoading?: boolean
  compact?: boolean
}) {
  const dateRangeLabel = date.slice(5)
  const queueSections = [
    ...(compact
      ? [
          makeQueueSectionData({
            key: 'due-today',
            title: 'due today',
            emptyMessage: 'No tasks due today',
            isReadOnly: true,
          }),
        ]
      : []),
    makeQueueSectionData({
      key: 'day',
      title: 'Today',
      items: dayQueueTask == null ? [] : [dayQueueTask],
      dateRangeLabel,
      emptyMessage: "No tasks in Today's queue",
    }),
    makeQueueSectionData({
      key: 'week',
      title: 'This week',
      dayGroups: [],
      dateRangeLabel: date === '2026-07-20' ? '07-20 – 07-26' : '07-27 – 08-02',
      emptyMessage: "No tasks in This week's queue",
    }),
  ]

  return {
    isLoading,
    isQueueRefreshing,
    nowPanelLoading,
    queueSections,
    dayQueueTasks: dayQueueTask == null ? [] : [dayQueueTask],
    queueCandidates:
      candidate == null
        ? []
        : [
            makeQueueCandidate({
              task: candidate,
              reason: { kind: 'active' },
            }),
          ],
  }
}

vi.mock('#components/calendar/calendar-change-feedback-popup', () => ({
  CalendarChangeFeedbackPopup: () => null,
}))

vi.mock('#components/day-view/day-view', () => ({
  DayViewPresentation: (props: DayViewMockProps) => {
    mocks.dayViewProps(props)
    return (
      <div
        data-testid="day-view"
        data-layout={props.layout}
        data-loading={props.isLoading}
      />
    )
  },
}))

vi.mock('#components/day-view/kanban-filter-row', () => ({
  KanbanFilterRow: () => null,
}))

vi.mock('#components/layout/app-layout', () => ({
  AppLayout: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-layout">{children}</div>
  ),
}))

vi.mock('#hooks/use-calendar-change-feedback', () => ({
  useCalendarChangeFeedback: () => ({
    changeFeedback: null,
    changeFeedbackAnchorRef: { current: null },
    handleTimeBlockChange: vi.fn(),
    dismissChangeFeedback: vi.fn(),
  }),
}))

vi.mock('#hooks/use-current-context', async () => {
  const { useSyncExternalStore } = await import('react')
  const subscribe = (listener: () => void) => {
    mocks.listeners.add(listener)
    return () => mocks.listeners.delete(listener)
  }

  return {
    useCurrentContext: () => {
      useSyncExternalStore(subscribe, () => mocks.revision)
      return mocks.context
    },
  }
})

vi.mock('#hooks/use-filtered-tasks', () => ({
  useBaseFilter: () => ({}),
}))

vi.mock('#hooks/use-gcal-events', () => ({
  GcalAuthRequiredError: class extends Error {},
  useGcalEvents: (...args: Parameters<GcalQueryMock>) => {
    mocks.useGcalEvents(...args)
    return { data: [], error: null }
  },
}))

vi.mock('#hooks/use-integrations', () => ({
  useIntegrationAuthUrl: () => ({ data: undefined }),
}))

vi.mock('#hooks/use-memos', () => ({
  useMemos: (...args: Parameters<MemosMock>) => mocks.useMemos(...args),
  useUpdateMemo: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('#hooks/use-projects', async (importOriginal) => {
  const original = await importOriginal<typeof import('#hooks/use-projects')>()
  return {
    ...original,
    useProjects: () => ({ data: [] }),
  }
})

vi.mock('#hooks/use-push-notifications', () => ({
  usePushResubscribe: () => {},
}))

vi.mock('#hooks/use-queues', () => ({
  DAY_QUEUE_KEY: 'day',
  WEEK_QUEUE_KEY: 'week',
  queueKeys: {
    all: ['queues'],
    itemsForQueue: (key: string) => ['queues', key, 'items'],
    items: (key: string, date: string) => ['queues', key, 'items', date],
    itemsRange: (key: string, from: string, to: string) => [
      'queues',
      key,
      'items',
      'range',
      from,
      to,
    ],
    rangeContainsDate: (
      queryKey: readonly unknown[],
      key: string,
      date: string,
    ) =>
      queryKey[0] === 'queues' &&
      queryKey[1] === key &&
      queryKey[2] === 'items' &&
      queryKey[3] === 'range' &&
      typeof queryKey[4] === 'string' &&
      typeof queryKey[5] === 'string' &&
      queryKey[4] <= date &&
      date <= queryKey[5],
  },
  useQueueItemsForQueues: (...args: Parameters<QueueItemsMock>) =>
    mocks.useQueueItemsForQueues(...args),
  useQueueCarryOver: (...args: Parameters<QueueCarryOverMock>) =>
    mocks.useQueueCarryOver(...args),
  useQueueItemsForRange: (...args: Parameters<QueueRangeMock>) =>
    mocks.useQueueItemsForRange(...args),
  fetchQueueItems: (...args: Parameters<typeof mocks.fetchQueueItems>) =>
    mocks.fetchQueueItems(...args),
  useQueues: (...args: Parameters<QueueListMock>) => mocks.useQueues(...args),
  useSetQueueItems: () => ({
    isPending: false,
    variables: { key: 'day' },
    mutate: mocks.setQueueItems,
    mutateAsync: (variables: QueueMutationVariables) =>
      new Promise<void>((resolve, reject) => {
        mocks.setQueueItems(variables, {
          onSuccess: () => {
            resolve()
          },
          onError: (error) => {
            reject(
              error instanceof Error
                ? error
                : new Error('queue mutation failed', { cause: error }),
            )
          },
        })
      }),
  }),
}))

vi.mock('#hooks/use-schedules', () => ({
  useScheduleList: (...args: Parameters<DateRangeQueryMock>) =>
    mocks.useScheduleList(...args),
}))

vi.mock('#hooks/use-selected-date', async () => {
  const { useSyncExternalStore } = await import('react')
  const subscribe = (listener: () => void) => {
    mocks.listeners.add(listener)
    return () => mocks.listeners.delete(listener)
  }

  return {
    useSelectedDate: () => {
      useSyncExternalStore(subscribe, () => mocks.revision)
      return {
        selectedDate: mocks.selectedDate ?? new Date('2026-07-20T00:00:00'),
        setSelectedDate: (date: Date) => {
          mocks.selectedDate = date
          notifyRouteMockChanges()
        },
      }
    },
  }
})

vi.mock('#hooks/use-service-worker-update', () => ({
  useServiceWorkerUpdate: () => {},
}))

vi.mock('#hooks/use-tasks', () => ({
  useTaskList: (...args: Parameters<TaskListMock>) =>
    mocks.useTaskList(...args),
  useTaskMap: (...args: Parameters<TaskMapMock>) => mocks.useTaskMap(...args),
}))

vi.mock('#hooks/use-time-blocks', () => ({
  useCreateTimeBlock: () => ({ mutate: mocks.createTimeBlock }),
  useTimeBlocks: (...args: Parameters<DateRangeQueryMock>) =>
    mocks.useTimeBlocks(...args),
  useUpdateTimeBlock: () => ({ mutate: vi.fn() }),
}))

// File routes are normally wired by routeTree.gen.ts; reproduce its runtime
// parent and ID so the test exercises the real route's search validation.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-type-assertion -- mirrors routeTree.gen.ts when wiring file routes
DayRoute.update({
  id: '/',
  path: '/',
  getParentRoute: () => RootRoute,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors routeTree.gen.ts when wiring file routes
} as any)
const testRouteTree = RootRoute.addChildren([DayRoute])

async function renderDayRoute(initialEntry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const router = createRouter({
    routeTree: testRouteTree,
    history: createMemoryHistory({ initialEntries: [initialEntry] }),
  })
  await router.load()

  const routeTree = () => (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
  const rendered = render(routeTree())
  return {
    ...rendered,
    queryClient,
    router,
    rerenderRoute: () => {
      notifyRouteMockChanges()
      rendered.rerender(routeTree())
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.useTaskList.mockReturnValue({
    data: [],
    isLoading: false,
    categorized: { all: [] },
  })
  mocks.useTimeBlocks.mockReturnValue({ data: [], error: null })
  mocks.useScheduleList.mockReturnValue({ data: [], error: null })
  mocks.useGcalEvents.mockReturnValue({ data: [], error: null })
  mocks.useMemos.mockReturnValue({
    data: undefined,
    error: null,
    isPending: false,
    isError: false,
  })
  mocks.useQueues.mockReturnValue({ data: [] })
  mocks.useQueueItemsForQueues.mockReturnValue([])
  mocks.useQueueCarryOver.mockImplementation(() => ({
    isSuccess: true,
    isPending: false,
    isError: false,
    error: null,
    isCarryingOver: false,
    canReadQueueItems: true,
  }))
  mocks.selectedDate = null
  mocks.context = 'work'
  mocks.revision = 0
  mocks.listeners.clear()
  mocks.queueTransitionTaskData.clear()
  mocks.queueTransitionItems.clear()
  mocks.queueTransitionRanges.clear()
  mocks.useQueueItemsForRange.mockReturnValue({
    data: [],
    error: null,
    errorUpdatedAt: 0,
  })
  mocks.useTaskMap.mockReturnValue(new Map())
  mocks.fetchQueueItems.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('day-view route task queries', () => {
  it('loads tasks referenced by Now panel time blocks', async () => {
    const taskId = 'now-panel-task'
    mocks.useTimeBlocks.mockImplementation((_startDate, _endDate, enabled) => ({
      data: enabled === true ? [makeTimeBlock({ taskId })] : [],
      error: null,
    }))

    const { queryClient } = await renderDayRoute('/?layout=compact')

    await waitFor(() => {
      const idQueryCall = mocks.useTaskList.mock.calls
        .filter(([filter]) => isTaskListFilterWith(filter, 'ids'))
        .at(-1)
      expect(idQueryCall?.[0]).toEqual({
        view: 'row',
        ids: [taskId],
        context: 'work',
        status: 'all',
        limit: 'unlimited',
        includeAncestors: true,
      })
    })

    queryClient.clear()
  })

  it('loads overdue task dates when today is in the visible range', async () => {
    const today = new Date()
    const todayStr = formatLocalDate(today)
    mocks.selectedDate = today

    const { queryClient } = await renderDayRoute('/')

    await waitFor(() => {
      expect(
        mocks.useTaskList.mock.calls
          .filter(([filter]) => isDueTaskQuery(filter))
          .at(-1),
      ).toEqual([
        {
          view: 'row',
          context: 'work',
          status: 'todo',
          dueTo: todayStr,
          sortBy: 'due',
          limit: 'unlimited',
        },
        { enabled: true },
      ])
    })

    queryClient.clear()
  })

  it('uses overdue query results to render today reminders outside the task date range', async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStr = formatLocalDate(today)
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = formatLocalDate(yesterday)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowStr = formatLocalDate(tomorrow)
    const overdueTask = makeTask({
      id: 'overdue-task',
      title: 'Review a sample note',
      dueDate: yesterdayStr,
    })
    mocks.selectedDate = today
    mocks.useTaskList.mockImplementation((filter) => ({
      data: isTaskListFilterWith(filter, 'dueTo') ? [overdueTask] : [],
      isLoading: false,
      categorized: { all: [] },
    }))

    const { queryClient } = await renderDayRoute('/')
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onVisibleRangeChange = assertDefined(
      presentationProps.onVisibleRangeChange,
    )
    act(() => {
      onVisibleRangeChange({
        start: new Date(`${todayStr}T00:00:00`),
        end: new Date(`${tomorrowStr}T00:00:00`),
      })
    })

    await waitFor(() => {
      expect(mocks.dayViewProps.mock.lastCall?.[0].calendarEvents).toEqual([
        {
          id: 'task-date-overdue-task-overdue-today',
          title: 'Review a sample note',
          start: todayStr,
          end: tomorrowStr,
          type: 'task-date',
          taskId: 'overdue-task',
          allDay: true,
          dateTaskKind: 'overdue-today',
          dateTaskOverdue: true,
          dateTaskDueDateLabel: formatShortDate(yesterdayStr, today),
          displayPriority: 1,
        },
      ])
    })

    queryClient.clear()
  })

  it('fetches referenced tasks and server-filtered candidates and dates', async () => {
    const selectedDate = new Date('2026-07-20T00:00:00')
    const selectedDateStr = formatLocalDate(selectedDate)
    const futureDate = '2026-07-21'
    const calendarDate = '2026-07-27'
    const queueTaskId = 'queued-task'
    const futureTaskId = 'future-day-task'
    const calendarTaskId = 'visible-calendar-day-task'
    const timeBlockTaskId = 'time-block-task'
    mocks.selectedDate = selectedDate
    mocks.useQueues.mockReturnValue({
      data: [
        makeQueue({ key: 'day', name: 'Today' }),
        makeQueue({
          key: 'week',
          name: 'This week',
          periodUnit: 'week',
          position: 1,
        }),
      ],
    })
    mocks.useQueueItemsForQueues.mockReturnValue([
      { data: [makeQueueItem({ taskId: queueTaskId })] },
      { data: [] },
    ])
    mocks.useQueueItemsForRange.mockReturnValue({
      data: [
        makeQueueItem({ taskId: futureTaskId, periodStart: futureDate }),
        makeQueueItem({ taskId: calendarTaskId, periodStart: calendarDate }),
      ],
      error: null,
      errorUpdatedAt: 0,
    })
    mocks.useTimeBlocks.mockReturnValue({
      data: [makeTimeBlock({ taskId: timeBlockTaskId })],
      error: null,
    })
    const futureTask = makeTask({
      id: futureTaskId,
      title: 'Review the first sample',
    })
    const calendarTask = makeTask({
      id: calendarTaskId,
      title: 'Review the second sample',
    })
    mocks.useTaskMap.mockReturnValue(
      new Map([
        [futureTask.id, futureTask],
        [calendarTask.id, calendarTask],
      ]),
    )

    const { queryClient } = await renderDayRoute('/')
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onVisibleRangeChange = assertDefined(
      presentationProps.onVisibleRangeChange,
    )
    act(() => {
      onVisibleRangeChange({
        start: new Date(`${calendarDate}T00:00:00`),
        end: new Date('2026-07-29T00:00:00'),
      })
    })

    await waitFor(() => {
      const idQueryCall = mocks.useTaskList.mock.calls
        .filter(([filter]) => isTaskListFilterWith(filter, 'ids'))
        .at(-1)
      const readResult = () => ({
        taskList: taskListQuerySnapshot(
          getEnabledTaskListFilters(),
          idQueryCall?.[1],
        ),
        queueSections: presentationProps.queueSections,
      })
      expect(readResult()).toEqual({
        taskList: taskListQuerySnapshot(
          [
            {
              view: 'row',
              context: 'work',
              status: 'todo',
              candidatesOn: selectedDateStr,
              limit: 'unlimited',
            },
            {
              view: 'row',
              context: 'work',
              status: 'todo',
              dateFrom: calendarDate,
              dateTo: '2026-07-28',
              limit: 'unlimited',
            },
            {
              view: 'row',
              ids: [
                'future-day-task',
                'queued-task',
                'time-block-task',
                'visible-calendar-day-task',
              ],
              context: 'work',
              status: 'all',
              limit: 'unlimited',
              includeAncestors: true,
            },
          ],
          { enabled: true, placeholderData: () => undefined },
        ),
        queueSections: [
          {
            key: 'day',
            title: 'Today',
            items: [],
            dateRangeLabel: '07-20',
            emptyMessage: "No tasks in Today's queue",
          },
          {
            key: 'week',
            title: 'This week',
            items: [],
            dayGroups: [
              {
                date: futureDate,
                label: 'Tue 07-21',
                items: [futureTask],
              },
            ],
            dateRangeLabel: '07-20 – 07-26',
            emptyMessage: "No tasks in This week's queue",
          },
        ],
      })
    })

    queryClient.clear()
  })
})

describe('day-view route queue date transition', () => {
  it('keeps the last settled queue until the latest date queries are ready', async () => {
    const initialDate = '2026-07-20'
    const intermediateDate = '2026-07-27'
    const latestDate = '2026-07-28'
    const oldQueueTask = makeTask({
      id: 'old-queue-task',
      title: 'Old queued task',
      context: 'work',
    })
    const intermediateQueueTask = makeTask({
      id: 'intermediate-queue-task',
      title: 'Intermediate queued task',
      context: 'work',
    })
    const latestQueueTask = makeTask({
      id: 'latest-queue-task',
      title: 'Latest queued task',
      context: 'work',
    })
    const oldCandidate = makeTask({
      id: 'old-candidate',
      title: 'Old candidate',
      context: 'work',
      candidateReason: { kind: 'active' },
    })
    const intermediateCandidate = makeTask({
      id: 'intermediate-candidate',
      title: 'Intermediate candidate',
      context: 'work',
      candidateReason: { kind: 'active' },
    })
    const latestCandidate = makeTask({
      id: 'latest-candidate',
      title: 'Latest candidate',
      context: 'work',
      candidateReason: { kind: 'active' },
    })
    const queues = [
      makeQueue({ key: 'day', name: 'Today' }),
      makeQueue({
        key: 'week',
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    mocks.selectedDate = new Date(`${initialDate}T00:00:00`)
    mocks.useQueues.mockReturnValue({ data: queues })
    mocks.useTaskMap.mockImplementation(
      (tasks) => new Map(tasks.map((task) => [task.id, task] as const)),
    )
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(initialDate), {
      candidateTasks: [oldCandidate],
      dateTasks: [],
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(initialDate, [
      {
        data: [
          makeQueueItem({ taskId: oldQueueTask.id, periodStart: initialDate }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-20:2026-07-26', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    configureQueueTransitionMocks()

    const route = await renderDayRoute('/?layout=compact')
    const oldQueue = makeExpectedQueueTransitionOutput({
      date: initialDate,
      dayQueueTask: oldQueueTask,
      candidate: oldCandidate,
    })
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(oldQueue)
    })

    mocks.selectedDate = new Date(`${intermediateDate}T00:00:00`)
    mocks.queueTransitionTaskData.set(
      queueTransitionScopeKey(intermediateDate),
      {
        candidateTasks: [intermediateCandidate],
        dateTasks: undefined,
        referencedTasks: {
          data: [oldQueueTask],
          isPlaceholderData: true,
          error: null,
        },
      },
    )
    mocks.queueTransitionItems.set(intermediateDate, [
      {
        data: [
          makeQueueItem({
            taskId: intermediateQueueTask.id,
            periodStart: intermediateDate,
          }),
        ],
        error: null,
      },
      { data: undefined, error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-27:2026-08-02', {
      data: undefined,
      error: null,
      errorUpdatedAt: 0,
    })
    act(() => {
      route.rerenderRoute()
    })
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual({
        ...oldQueue,
        isQueueRefreshing: true,
      })
    })

    const transitioningProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    act(() => {
      transitioningProps.onAddCandidate?.(oldCandidate.id)
      transitioningProps.onInsertCandidate?.('week', oldCandidate.id)
      transitioningProps.onRemoveFromQueue?.('day', oldQueueTask.id)
      transitioningProps.onMoveTask?.(oldQueueTask.id, 'day', 'week')
      transitioningProps.onMoveScheduledTaskToWeek?.(
        oldQueueTask.id,
        intermediateDate,
      )
    })

    const dndCallbacks = assertDefined(transitioningProps.dndCallbacks)
    const revertCalendarQueueDrop = vi.fn()
    act(() => {
      dndCallbacks.onEventDrop?.({
        eventId: 'queued-event',
        eventType: 'day-queue',
        taskId: oldQueueTask.id,
        isAllDay: true,
        wasAllDay: true,
        newStart: new Date(`${intermediateDate}T00:00:00`),
        newEnd: new Date(`${intermediateDate}T00:00:00`),
        oldStart: new Date(`${initialDate}T00:00:00`),
        oldEnd: new Date(`${initialDate}T00:00:00`),
        el: document.createElement('div'),
        revert: revertCalendarQueueDrop,
      })
      dndCallbacks.onExternalDrop?.({
        taskId: oldQueueTask.id,
        taskTitle: oldQueueTask.title,
        start: new Date(`${intermediateDate}T00:00:00`),
        end: new Date(`${intermediateDate}T00:00:00`),
        allDay: true,
        sourceQueueKey: 'day',
        sourceDate: initialDate,
      })
    })
    expect(
      readQueueTransitionInteractionResult(revertCalendarQueueDrop),
    ).toEqual({
      mutationCalls: [],
      calendarQueueDropReverted: [[]],
    })

    mocks.selectedDate = new Date(`${latestDate}T00:00:00`)
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(latestDate), {
      candidateTasks: undefined,
      dateTasks: undefined,
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: true,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(latestDate, [
      {
        data: [
          makeQueueItem({
            taskId: latestQueueTask.id,
            periodStart: latestDate,
          }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    act(() => {
      route.rerenderRoute()
    })
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual({
        ...oldQueue,
        isQueueRefreshing: true,
      })
    })

    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(latestDate), {
      candidateTasks: [latestCandidate],
      dateTasks: undefined,
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: true,
        error: null,
      },
    })
    act(() => {
      route.rerenderRoute()
    })
    expect(readQueueTransitionOutput()).toEqual({
      ...oldQueue,
      isQueueRefreshing: true,
    })

    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(latestDate), {
      candidateTasks: [latestCandidate],
      dateTasks: [],
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: true,
        error: null,
      },
    })
    act(() => {
      route.rerenderRoute()
    })
    expect(readQueueTransitionOutput()).toEqual({
      ...oldQueue,
      isQueueRefreshing: true,
    })

    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(latestDate), {
      candidateTasks: [latestCandidate],
      dateTasks: [latestQueueTask],
      referencedTasks: {
        data: [latestQueueTask],
        isPlaceholderData: false,
        error: null,
      },
    })
    act(() => {
      route.rerenderRoute()
    })
    expect(readQueueTransitionOutput()).toEqual({
      ...oldQueue,
      isQueueRefreshing: true,
    })

    mocks.queueTransitionRanges.set('2026-07-27:2026-08-02', {
      data: [],
      error: null,
      errorUpdatedAt: 1,
    })
    act(() => {
      route.rerenderRoute()
    })
    expect(readQueueTransitionOutput()).toEqual(
      makeExpectedQueueTransitionOutput({
        date: latestDate,
        dayQueueTask: latestQueueTask,
        candidate: latestCandidate,
      }),
    )

    route.queryClient.clear()
  })

  it('does not wait for calendar-only task references to settle the queue', async () => {
    const initialDate = '2026-07-20'
    const targetDate = '2026-07-27'
    const oldQueueTask = makeTask({
      id: 'old-queue-task',
      title: 'Old queued task',
      context: 'work',
    })
    const targetQueueTask = makeTask({
      id: 'target-queue-task',
      title: 'Target queued task',
      context: 'work',
    })
    const queues = [
      makeQueue({ key: 'day', name: 'Today' }),
      makeQueue({
        key: 'week',
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    const nowPanelStartDate = getNowPanelQueryDateRange(new Date()).startDate
    mocks.useTimeBlocks.mockImplementation((startDate) => ({
      data:
        startDate === nowPanelStartDate
          ? []
          : [makeTimeBlock({ taskId: 'calendar-only-task' })],
      error: null,
    }))
    mocks.selectedDate = new Date(`${initialDate}T00:00:00`)
    mocks.useQueues.mockReturnValue({ data: queues })
    mocks.useTaskMap.mockImplementation(
      (tasks) => new Map(tasks.map((task) => [task.id, task] as const)),
    )
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(initialDate), {
      candidateTasks: [],
      dateTasks: [],
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(initialDate, [
      {
        data: [
          makeQueueItem({ taskId: oldQueueTask.id, periodStart: initialDate }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-20:2026-07-26', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    configureQueueTransitionMocks()
    const route = await renderDayRoute('/?layout=compact')

    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: initialDate,
          dayQueueTask: oldQueueTask,
        }),
      )
    })

    mocks.selectedDate = new Date(`${targetDate}T00:00:00`)
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(targetDate), {
      candidateTasks: [],
      dateTasks: [targetQueueTask],
      referencedTasks: {
        data: undefined,
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(targetDate, [
      {
        data: [
          makeQueueItem({
            taskId: targetQueueTask.id,
            periodStart: targetDate,
          }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-27:2026-08-02', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    act(() => {
      route.rerenderRoute()
    })

    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: targetDate,
          dayQueueTask: targetQueueTask,
        }),
      )
    })

    route.queryClient.clear()
  })

  it('releases the previous queue when a settled reference query excludes a task', async () => {
    const initialDate = '2026-07-20'
    const targetDate = '2026-07-27'
    const oldQueueTask = makeTask({
      id: 'old-queue-task',
      title: 'Old queued task',
      context: 'work',
    })
    const queues = [
      makeQueue({ key: 'day', name: 'Today' }),
      makeQueue({
        key: 'week',
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    mocks.selectedDate = new Date(`${initialDate}T00:00:00`)
    mocks.useQueues.mockReturnValue({ data: queues })
    mocks.useTaskMap.mockImplementation(
      (tasks) => new Map(tasks.map((task) => [task.id, task] as const)),
    )
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(initialDate), {
      candidateTasks: [],
      dateTasks: [],
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(initialDate, [
      {
        data: [
          makeQueueItem({ taskId: oldQueueTask.id, periodStart: initialDate }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-20:2026-07-26', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    configureQueueTransitionMocks()
    const route = await renderDayRoute('/?layout=compact')

    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: initialDate,
          dayQueueTask: oldQueueTask,
        }),
      )
    })

    mocks.selectedDate = new Date(`${targetDate}T00:00:00`)
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(targetDate), {
      candidateTasks: [],
      dateTasks: [],
      referencedTasks: {
        data: [],
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(targetDate, [
      {
        data: [
          makeQueueItem({
            taskId: 'other-context-task',
            periodStart: targetDate,
          }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-27:2026-08-02', {
      data: [],
      error: null,
      errorUpdatedAt: 1,
    })
    act(() => {
      route.rerenderRoute()
    })

    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({ date: targetDate }),
      )
    })

    route.queryClient.clear()
  })

  it('releases the previous queue when a required query fails', async () => {
    const initialDate = '2026-07-20'
    const targetDate = '2026-07-27'
    const oldQueueTask = makeTask({
      id: 'old-queue-task',
      title: 'Old queued task',
      context: 'work',
    })
    const targetCandidate = makeTask({
      id: 'target-candidate',
      title: 'Target candidate',
      context: 'work',
      candidateReason: { kind: 'active' },
    })
    const queues = [
      makeQueue({ key: 'day', name: 'Today' }),
      makeQueue({
        key: 'week',
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    const queryError = new Error('queue items unavailable')
    mocks.selectedDate = new Date(`${initialDate}T00:00:00`)
    mocks.useQueues.mockReturnValue({ data: queues })
    mocks.useTaskMap.mockReturnValue(new Map([[oldQueueTask.id, oldQueueTask]]))
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(initialDate), {
      candidateTasks: [],
      dateTasks: [],
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(initialDate, [
      {
        data: [
          makeQueueItem({ taskId: oldQueueTask.id, periodStart: initialDate }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-20:2026-07-26', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    configureQueueTransitionMocks()
    const route = await renderDayRoute('/')
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: initialDate,
          dayQueueTask: oldQueueTask,
          compact: false,
        }),
      )
    })

    mocks.selectedDate = new Date(`${targetDate}T00:00:00`)
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(targetDate), {
      candidateTasks: [targetCandidate],
      dateTasks: [],
      referencedTasks: {
        data: undefined,
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(targetDate, [
      { data: undefined, error: queryError },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-27:2026-08-02', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    act(() => {
      route.rerenderRoute()
    })
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: targetDate,
          candidate: targetCandidate,
          compact: false,
        }),
      )
    })

    route.queryClient.clear()
  })

  it('does not retain a queue when task context changes', async () => {
    const initialDate = '2026-07-20'
    const oldQueueTask = makeTask({
      id: 'old-queue-task',
      title: 'Old queued task',
      context: 'work',
    })
    const oldCandidate = makeTask({
      id: 'old-candidate',
      title: 'Old candidate',
      context: 'work',
      candidateReason: { kind: 'active' },
    })
    const queues = [
      makeQueue({ key: 'day', name: 'Today' }),
      makeQueue({
        key: 'week',
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    mocks.selectedDate = new Date(`${initialDate}T00:00:00`)
    mocks.useQueues.mockReturnValue({ data: queues })
    mocks.useTaskMap.mockReturnValue(new Map([[oldQueueTask.id, oldQueueTask]]))
    mocks.queueTransitionTaskData.set(queueTransitionScopeKey(initialDate), {
      candidateTasks: [oldCandidate],
      dateTasks: [],
      referencedTasks: {
        data: [oldQueueTask],
        isPlaceholderData: false,
        error: null,
      },
    })
    mocks.queueTransitionItems.set(initialDate, [
      {
        data: [
          makeQueueItem({ taskId: oldQueueTask.id, periodStart: initialDate }),
        ],
        error: null,
      },
      { data: [], error: null },
    ])
    mocks.queueTransitionRanges.set('2026-07-20:2026-07-26', {
      data: [],
      error: null,
      errorUpdatedAt: 0,
    })
    configureQueueTransitionMocks()
    const route = await renderDayRoute('/')
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: initialDate,
          dayQueueTask: oldQueueTask,
          candidate: oldCandidate,
          compact: false,
        }),
      )
    })

    mocks.context = 'personal'
    mocks.useTaskMap.mockReturnValue(new Map())
    act(() => {
      route.rerenderRoute()
    })
    await waitFor(() => {
      expect(readQueueTransitionOutput()).toEqual(
        makeExpectedQueueTransitionOutput({
          date: initialDate,
          isLoading: true,
          nowPanelLoading: false,
          compact: false,
        }),
      )
    })

    route.queryClient.clear()
  })
})

describe('day-view route compact layout', () => {
  it('waits for carry-over before reading today queue items', async () => {
    const today = new Date()
    const todayStr = formatLocalDate(today)
    mocks.selectedDate = today
    mocks.useQueues.mockReturnValue({
      data: [makeQueue({ key: 'day', name: 'today' })],
    })
    mocks.useQueueCarryOver.mockReturnValue({
      isSuccess: false,
      isPending: true,
      isError: false,
      error: null,
      isCarryingOver: true,
      canReadQueueItems: false,
    })

    const { queryClient } = await renderDayRoute('/')

    await waitFor(() => {
      const getOutput = () => [
        mocks.useQueueCarryOver.mock.calls.at(-1),
        mocks.useQueueItemsForQueues.mock.calls.at(-1),
      ]
      expect(getOutput()).toEqual([
        [todayStr],
        [
          [makeQueue({ key: 'day', name: 'today' })],
          todayStr,
          { enabled: false },
        ],
      ])
    })

    queryClient.clear()
  })

  it('reads today queue items if carry-over fails', async () => {
    const today = new Date()
    const todayStr = formatLocalDate(today)
    const error = new Error('carry-over unavailable')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.selectedDate = today
    mocks.useQueueCarryOver.mockReturnValue({
      isSuccess: false,
      isPending: false,
      isError: true,
      error,
      isCarryingOver: false,
      canReadQueueItems: true,
    })

    const { queryClient } = await renderDayRoute('/')

    await waitFor(() => {
      expect(mocks.useQueueItemsForQueues.mock.calls.at(-1)).toEqual([
        [],
        todayStr,
        { enabled: true },
      ])
    })

    queryClient.clear()
  })

  it('does not carry over when a past date is selected', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1)
    const pastDateStr = formatLocalDate(pastDate)
    mocks.selectedDate = pastDate

    const { queryClient } = await renderDayRoute('/')

    await waitFor(() => {
      const getOutput = () => [
        mocks.useQueueCarryOver.mock.calls.at(-1),
        mocks.useQueueItemsForQueues.mock.calls.at(-1),
      ]
      expect(getOutput()).toEqual([
        [pastDateStr],
        [[], pastDateStr, { enabled: true }],
      ])
    })

    queryClient.clear()
  })

  it('does not carry over when a future date is selected', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 1)
    const futureDateStr = formatLocalDate(futureDate)
    mocks.selectedDate = futureDate

    const { queryClient } = await renderDayRoute('/')

    await waitFor(() => {
      const getOutput = () => [
        mocks.useQueueCarryOver.mock.calls.at(-1),
        mocks.useQueueItemsForQueues.mock.calls.at(-1),
      ]
      expect(getOutput()).toEqual([
        [futureDateStr],
        [[], futureDateStr, { enabled: true }],
      ])
    })

    queryClient.clear()
  })

  it('activates the compact shell without polling SSE-backed queries', async () => {
    const { queryClient, router } = await renderDayRoute('/?layout=compact')
    const nowPanelRange = getNowPanelQueryDateRange(new Date())
    const todayStr = formatLocalDate(new Date())
    const getCompactRouteState = () => ({
      pathname: router.state.location.pathname,
      layout: screen.getByTestId('day-view').getAttribute('data-layout'),
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      dueTaskCall: mocks.useTaskList.mock.calls.find(([filter]) =>
        isDueTaskQuery(filter),
      ),
      memoArgs: mocks.useMemos.mock.calls.at(-1),
      nowPanelTimeBlocksRange: mocks.useTimeBlocks.mock.calls
        .find((call) => call[2] === true)
        ?.slice(0, 2),
      nowPanelSchedulesRange: mocks.useScheduleList.mock.calls
        .find((call) => call[2] === true)
        ?.slice(0, 2),
      nowPanelGcalRange: mocks.useGcalEvents.mock.calls
        .find((call) => call[3] === true)
        ?.slice(0, 2),
      queueItemsOptions: mocks.useQueueItemsForQueues.mock.calls[0]?.[2],
    })

    await waitFor(() => {
      expect(getCompactRouteState()).toEqual({
        pathname: '/',
        layout: 'compact',
        appLayoutVisible: false,
        dueTaskCall: [
          {
            view: 'row',
            context: 'work',
            status: 'todo',
            dueTo: todayStr,
            sortBy: 'due',
            limit: 'unlimited',
          },
          { enabled: true },
        ],
        memoArgs: ['work', true],
        nowPanelTimeBlocksRange: [
          nowPanelRange.startDate,
          nowPanelRange.endDate,
        ],
        nowPanelSchedulesRange: [
          nowPanelRange.startDate,
          nowPanelRange.endDate,
        ],
        nowPanelGcalRange: [nowPanelRange.startDate, nowPanelRange.endDate],
        queueItemsOptions: { enabled: true },
      })
    })

    queryClient.clear()
  })

  it('keeps the default shell and does not poll when compact mode is absent', async () => {
    const { queryClient, router } = await renderDayRoute('/?layout=unsupported')
    const todayStr = formatLocalDate(new Date())
    const getDefaultRouteState = () => ({
      pathname: router.state.location.pathname,
      layout: screen.getByTestId('day-view').getAttribute('data-layout'),
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      dueTaskCall: mocks.useTaskList.mock.calls.find(([filter]) =>
        isDueTaskQuery(filter),
      ),
      memoArgs: mocks.useMemos.mock.calls.at(-1),
      nowPanelTimeBlocksEnabled: mocks.useTimeBlocks.mock.calls.some(
        (call) => call[2] === false,
      ),
      nowPanelSchedulesEnabled: mocks.useScheduleList.mock.calls.some(
        (call) => call[2] === false,
      ),
      nowPanelGcalEnabled: mocks.useGcalEvents.mock.calls.some(
        (call) => call[3] === false,
      ),
      queueItemsOptions: mocks.useQueueItemsForQueues.mock.calls[0]?.[2],
    })

    await waitFor(() => {
      expect(getDefaultRouteState()).toEqual({
        pathname: '/',
        layout: 'default',
        appLayoutVisible: true,
        dueTaskCall: [
          {
            view: 'row',
            context: 'work',
            status: 'todo',
            dueTo: todayStr,
            sortBy: 'due',
            limit: 'unlimited',
          },
          { enabled: false },
        ],
        memoArgs: ['work', false],
        nowPanelTimeBlocksEnabled: true,
        nowPanelSchedulesEnabled: true,
        nowPanelGcalEnabled: true,
        queueItemsOptions: { enabled: true },
      })
    })

    queryClient.clear()
  })

  it('shows a loading state while the compact due-date query loads', async () => {
    mocks.useTaskList.mockImplementation((filter) => {
      const isDueTask = isDueTaskQuery(filter)

      return {
        data: isDueTask ? undefined : [],
        isLoading: isDueTask,
        categorized: { all: [] },
      }
    })

    const { queryClient } = await renderDayRoute('/?layout=compact')
    const getDayViewLoadingState = () => ({
      layout: screen.getByTestId('day-view').getAttribute('data-layout'),
      loading: screen.getByTestId('day-view').getAttribute('data-loading'),
    })

    await waitFor(() => {
      expect(getDayViewLoadingState()).toEqual({
        layout: 'compact',
        loading: 'true',
      })
    })

    queryClient.clear()
  })

  it('logs compact data refresh errors', async () => {
    const timeBlocksError = new Error('time blocks unavailable')
    const schedulesError = new Error('schedules unavailable')
    const dueTasksError = new Error('due tasks unavailable')
    const memosError = new Error('memos unavailable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useTimeBlocks.mockReturnValue({ data: [], error: timeBlocksError })
    mocks.useScheduleList.mockReturnValue({ data: [], error: schedulesError })
    mocks.useMemos.mockReturnValue({
      data: undefined,
      error: memosError,
      isPending: false,
      isError: true,
    })
    mocks.useTaskList.mockImplementation((filter) => {
      const isDueTask = isDueTaskQuery(filter)

      return {
        data: [],
        ...(isDueTask ? { error: dueTasksError } : {}),
        isLoading: false,
        categorized: { all: [] },
      }
    })

    const { queryClient } = await renderDayRoute('/?layout=compact')
    const getLoggedErrors = () => consoleError.mock.calls

    await waitFor(() => {
      expect(getLoggedErrors()).toEqual([
        [
          'Failed to refresh day view time blocks in compact layout',
          timeBlocksError,
        ],
        [
          'Failed to refresh day view schedules in compact layout',
          schedulesError,
        ],
        [
          'Failed to refresh day view due tasks in compact layout',
          dueTasksError,
        ],
        [
          'Failed to refresh Now panel time blocks in compact layout',
          timeBlocksError,
        ],
        [
          'Failed to refresh Now panel schedules in compact layout',
          schedulesError,
        ],
        ['Failed to refresh day view memos in compact layout', memosError],
      ])
    })

    queryClient.clear()
  })
})

describe('day-view route scheduled week tasks', () => {
  it('shows a later day queue task and returns it to the week queue with its placed date', async () => {
    const scheduledDate = '2026-07-21'
    const scheduledTask = makeTask({
      id: 'scheduled-task',
      title: 'Review the release notes',
      commitment: 'active',
    })
    const queues = [
      makeQueue({ key: 'day', name: 'Today' }),
      makeQueue({
        key: 'week',
        name: 'This week',
        periodUnit: 'week',
        position: 1,
      }),
    ]
    mocks.useTaskList.mockReturnValue({
      data: [scheduledTask],
      isLoading: false,
      categorized: { all: [scheduledTask] },
    })
    mocks.useQueues.mockReturnValue({ data: queues })
    mocks.useQueueItemsForQueues.mockReturnValue([{ data: [] }, { data: [] }])
    mocks.useTaskMap.mockReturnValue(
      new Map([[scheduledTask.id, scheduledTask]]),
    )
    mocks.useQueueItemsForRange.mockReturnValue({
      data: [
        makeQueueItem({
          taskId: scheduledTask.id,
          periodStart: scheduledDate,
        }),
      ],
      error: null,
      errorUpdatedAt: 0,
    })

    const { queryClient } = await renderDayRoute('/')
    const weekItemsKey = ['queues', 'week', 'items', '2026-07-20']
    const dayItemsKey = ['queues', 'day', 'items', scheduledDate]
    queryClient.setQueryData(weekItemsKey, [])
    queryClient.setQueryData(dayItemsKey, [
      makeQueueItem({ taskId: scheduledTask.id }),
    ])

    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onMoveScheduledTaskToWeek = assertDefined(
      presentationProps.onMoveScheduledTaskToWeek,
    )
    const queueCandidateTaskIds = assertDefined(
      presentationProps.queueCandidates,
    ).map(({ task }) => task.id)
    act(() => {
      onMoveScheduledTaskToWeek(scheduledTask.id, scheduledDate)
    })
    const mutationOptions = assertDefined(
      mocks.setQueueItems.mock.calls[0]?.[1],
    )
    act(() => {
      mutationOptions.onSuccess?.()
    })

    const readResult = () => ({
      fetchedRange: mocks.useQueueItemsForRange.mock.calls
        .map(([key, from, to]) => ({ key, from, to }))
        .at(-1),
      queueSections: presentationProps.queueSections,
      queueCandidateTaskIds,
      mutationVariables: mocks.setQueueItems.mock.calls.map(
        ([variables]) => variables,
      ),
      cacheInvalidation: [weekItemsKey, dayItemsKey].map(
        (key) => queryClient.getQueryState(key)?.isInvalidated,
      ),
    })

    expect(readResult()).toEqual({
      fetchedRange: { key: 'day', from: '2026-07-20', to: '2026-07-26' },
      queueSections: [
        {
          key: 'day',
          title: 'Today',
          items: [],
          dateRangeLabel: '07-20',
          emptyMessage: "No tasks in Today's queue",
        },
        {
          key: 'week',
          title: 'This week',
          items: [],
          dayGroups: [
            {
              date: scheduledDate,
              label: 'Tue 07-21',
              items: [scheduledTask],
            },
          ],
          dateRangeLabel: '07-20 – 07-26',
          emptyMessage: "No tasks in This week's queue",
        },
      ],
      queueCandidateTaskIds: [],
      mutationVariables: [
        { key: 'week', date: scheduledDate, taskIds: [scheduledTask.id] },
      ],
      cacheInvalidation: [true, true],
    })
    queryClient.clear()
  })

  it('logs failures while loading future day queues', async () => {
    const error = new Error('queue request failed')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useQueues.mockReturnValue({
      data: [makeQueue({ key: 'day', name: 'Today' })],
    })
    mocks.useQueueItemsForRange.mockReturnValue({
      data: [],
      error,
      errorUpdatedAt: 123,
    })

    const { queryClient } = await renderDayRoute('/')
    const readQueueErrorLogs = () =>
      consoleError.mock.calls.filter(
        ([message]) => message === 'Failed to refresh day queue items',
      )

    await waitFor(() => {
      expect(readQueueErrorLogs()).toEqual([
        [
          'Failed to refresh day queue items',
          { from: '2026-07-20', to: '2026-07-26', error },
        ],
      ])
    })
    queryClient.clear()
  })
})

describe('day queue calendar interactions', () => {
  it('loads one day queue range covering the visible dates and selected week', async () => {
    mocks.useQueues.mockReturnValue({
      data: [makeQueue({ key: 'day', name: 'today' })],
    })

    const { queryClient } = await renderDayRoute('/')
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onVisibleRangeChange = assertDefined(
      presentationProps.onVisibleRangeChange,
    )

    act(() => {
      onVisibleRangeChange({
        start: new Date('2026-07-19T00:00:00'),
        end: new Date('2026-07-23T00:00:00'),
      })
    })

    await waitFor(() => {
      const calendarQuery = mocks.useQueueItemsForRange.mock.calls
        .map(([key, from, to]) => ({ key, from, to }))
        .at(-1)
      expect(calendarQuery).toEqual({
        key: 'day',
        from: '2026-07-19',
        to: '2026-07-26',
      })
    })
    queryClient.clear()
  })

  it('logs each visible day queue query error once', async () => {
    const error = new Error('day queue unavailable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useQueues.mockReturnValue({
      data: [makeQueue({ key: 'day', name: 'today' })],
    })
    mocks.useQueueItemsForRange.mockReturnValue({
      data: undefined,
      error,
      errorUpdatedAt: 1,
    })

    const { queryClient } = await renderDayRoute('/')
    const getActual = () =>
      consoleError.mock.calls.filter(
        ([message]) => message === 'Failed to refresh day queue items',
      )

    await waitFor(() => {
      expect(getActual()).toEqual([
        [
          'Failed to refresh day queue items',
          { from: '2026-07-20', to: '2026-07-26', error },
        ],
      ])
    })
    queryClient.clear()
  })

  it('moves a queued task to another day and removes it from its source day', async () => {
    const sourceDate = '2026-07-20'
    const targetDate = '2026-07-21'
    const taskId = 'queued-sample-a'
    const { queryClient } = await renderDayRoute('/')
    queryClient.setQueryData<QueueItem[]>(
      ['queues', 'day', 'items', 'range', '2026-07-20', '2026-07-26'],
      [
        makeQueueItem({ taskId, periodStart: sourceDate }),
        makeQueueItem({
          id: 'queue-item-source',
          taskId: 'queued-sample-b',
          periodStart: sourceDate,
        }),
        makeQueueItem({
          id: 'queue-item-target',
          taskId: 'queued-sample-c',
          periodStart: targetDate,
        }),
      ],
    )
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onEventDrop = assertDefined(
      presentationProps.dndCallbacks?.onEventDrop,
    )
    const revert = vi.fn()

    act(() => {
      onEventDrop({
        eventId: `day-queue-${sourceDate}-${taskId}`,
        eventType: 'day-queue',
        taskId,
        isAllDay: true,
        wasAllDay: true,
        newStart: new Date('2026-07-21T00:00:00'),
        newEnd: new Date('2026-07-22T00:00:00'),
        oldStart: new Date('2026-07-20T00:00:00'),
        oldEnd: new Date('2026-07-21T00:00:00'),
        el: document.createElement('div'),
        revert,
      })
    })

    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(1)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[0]?.[1]).onSuccess?.()
    })
    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(2)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[1]?.[1]).onSuccess?.()
    })

    const getActual = () => ({
      updates: mocks.setQueueItems.mock.calls.map(([variables]) => variables),
      revertCalls: revert.mock.calls.length,
    })
    expect(getActual()).toEqual({
      updates: [
        {
          key: 'day',
          date: sourceDate,
          taskIds: ['queued-sample-b'],
        },
        {
          key: 'day',
          date: targetDate,
          taskIds: ['queued-sample-c', taskId],
        },
      ],
      revertCalls: 0,
    })
    queryClient.clear()
  })

  it('removes a moved task only from its selected date in a range cache', async () => {
    const selectedDate = '2026-07-20'
    const taskId = 'queued-sample-a'
    const selectedDateItem = makeQueueItem({
      taskId,
      periodStart: selectedDate,
    })
    const sameTaskOnAnotherDate = makeQueueItem({
      id: 'queue-item-other-date',
      taskId,
      periodStart: '2026-07-22',
    })
    const rangeKey = [
      'queues',
      'day',
      'items',
      'range',
      '2026-07-20',
      '2026-07-26',
    ]
    const { queryClient } = await renderDayRoute('/')
    act(() => {
      queryClient.setQueryData(rangeKey, [
        selectedDateItem,
        sameTaskOnAnotherDate,
      ])
    })

    const onMoveTask = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0].onMoveTask,
    )
    act(() => {
      onMoveTask(taskId, 'day', 'week')
      assertDefined(mocks.setQueueItems.mock.calls[0]?.[1]).onSuccess?.()
    })

    expect(queryClient.getQueryData(rangeKey)).toEqual([sameTaskOnAnotherDate])
    queryClient.clear()
  })

  it('restores the source day and reverts when the destination update fails', async () => {
    const sourceDate = '2026-07-20'
    const targetDate = '2026-07-21'
    const taskId = 'queued-sample-a'
    const destinationError = new Error('destination update failed')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { queryClient } = await renderDayRoute('/')
    queryClient.setQueryData<QueueItem[]>(
      ['queues', 'day', 'items', sourceDate],
      [
        makeQueueItem({ taskId }),
        makeQueueItem({ id: 'queue-item-source', taskId: 'queued-sample-b' }),
      ],
    )
    queryClient.setQueryData<QueueItem[]>(
      ['queues', 'day', 'items', targetDate],
      [makeQueueItem({ id: 'queue-item-target', taskId: 'queued-sample-c' })],
    )
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onEventDrop = assertDefined(
      presentationProps.dndCallbacks?.onEventDrop,
    )
    const revert = vi.fn()

    act(() => {
      onEventDrop({
        eventId: `day-queue-${sourceDate}-${taskId}`,
        eventType: 'day-queue',
        taskId,
        isAllDay: true,
        wasAllDay: true,
        newStart: new Date('2026-07-21T00:00:00'),
        newEnd: new Date('2026-07-22T00:00:00'),
        oldStart: new Date('2026-07-20T00:00:00'),
        oldEnd: new Date('2026-07-21T00:00:00'),
        el: document.createElement('div'),
        revert,
      })
    })

    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(1)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[0]?.[1]).onSuccess?.()
    })
    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(2)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[1]?.[1]).onError?.(
        destinationError,
      )
    })
    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(3)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[2]?.[1]).onSuccess?.()
    })
    await waitFor(() => {
      expect(revert.mock.calls).toEqual([[]])
    })

    const getActual = () => ({
      updates: mocks.setQueueItems.mock.calls.map(([variables]) => variables),
      revertCalls: revert.mock.calls,
    })
    expect(getActual()).toEqual({
      updates: [
        { key: 'day', date: sourceDate, taskIds: ['queued-sample-b'] },
        { key: 'day', date: targetDate, taskIds: ['queued-sample-c', taskId] },
        {
          key: 'day',
          date: sourceDate,
          taskIds: [taskId, 'queued-sample-b'],
        },
      ],
      revertCalls: [[]],
    })
    queryClient.clear()
  })

  it('creates a time block when a day queue event is moved to a time slot', async () => {
    const taskId = 'queued-sample-a'
    const { queryClient } = await renderDayRoute('/')
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onEventDrop = assertDefined(
      presentationProps.dndCallbacks?.onEventDrop,
    )

    act(() => {
      onEventDrop({
        eventId: `day-queue-2026-07-20-${taskId}`,
        eventType: 'day-queue',
        taskId,
        isAllDay: false,
        wasAllDay: true,
        newStart: new Date('2026-07-20T09:00:00+09:00'),
        newEnd: new Date('2026-07-20T10:00:00+09:00'),
        oldStart: new Date('2026-07-20T00:00:00+09:00'),
        oldEnd: new Date('2026-07-21T00:00:00+09:00'),
        el: document.createElement('div'),
        revert: vi.fn(),
      })
    })

    const getActual = () => ({
      timeBlocks: mocks.createTimeBlock.mock.calls,
      queueUpdates: mocks.setQueueItems.mock.calls,
    })
    expect(getActual()).toEqual({
      timeBlocks: [
        [
          {
            taskId,
            startTime: '2026-07-20T00:00:00.000Z',
            endTime: '2026-07-20T01:00:00.000Z',
          },
        ],
      ],
      queueUpdates: [],
    })
    queryClient.clear()
  })

  it('adds an external all-day drop to that date’s day queue', async () => {
    const date = '2026-07-22'
    const taskId = 'queued-sample-a'
    const { queryClient } = await renderDayRoute('/')
    queryClient.setQueryData<QueueItem[]>(
      ['queues', 'day', 'items', date],
      [makeQueueItem({ id: 'queue-item-existing', taskId: 'queued-sample-b' })],
    )
    queryClient.setQueryData<QueueItem[]>(
      ['queues', 'week', 'items', '2026-07-20'],
      [
        makeQueueItem({ id: 'queue-item-week', taskId }),
        makeQueueItem({
          id: 'queue-item-week-other',
          taskId: 'queued-sample-c',
        }),
      ],
    )
    const presentationProps = assertDefined(
      mocks.dayViewProps.mock.lastCall?.[0],
    )
    const onExternalDrop = assertDefined(
      presentationProps.dndCallbacks?.onExternalDrop,
    )

    act(() => {
      onExternalDrop({
        taskId,
        taskTitle: 'Prepare sample outline',
        start: new Date(2026, 6, 22),
        end: new Date(2026, 6, 23),
        allDay: true,
        sourceQueueKey: 'week',
        sourceDate: '2026-07-20',
      })
    })

    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(1)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[0]?.[1]).onSuccess?.()
    })
    await waitFor(() => {
      expect(mocks.setQueueItems).toHaveBeenCalledTimes(2)
    })
    act(() => {
      assertDefined(mocks.setQueueItems.mock.calls[1]?.[1]).onSuccess?.()
    })
    const getActual = () => ({
      updates: mocks.setQueueItems.mock.calls.map(([variables]) => variables),
      timeBlocks: mocks.createTimeBlock.mock.calls,
    })
    expect(getActual()).toEqual({
      updates: [
        {
          key: 'week',
          date: '2026-07-20',
          taskIds: ['queued-sample-c'],
        },
        { key: 'day', date, taskIds: ['queued-sample-b', taskId] },
      ],
      timeBlocks: [],
    })
    queryClient.clear()
  })
})

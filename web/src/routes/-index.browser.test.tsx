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
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeQueue } from '#hooks/queue-test-fixtures'
import type { QueueItem } from '#hooks/use-queues'
import { getNowPanelQueryDateRange } from '#lib/compact-layout'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined } from '#lib/test-utils'
import { Route as RootRoute } from '#routes/__root'
import { Route as DayRoute } from '#routes/index'

type TaskListMock = (
  filter: unknown,
  options?: { enabled?: boolean; refetchInterval?: number },
) => unknown
type DateRangeQueryMock = (
  startDate: string,
  endDate: string,
  refetchInterval?: number,
  enabled?: boolean,
) => unknown
type GcalQueryMock = (
  startDate: string,
  endDate: string,
  context: 'work' | 'personal',
  enabled?: boolean,
) => unknown
type QueueListMock = (refetchInterval?: number) => unknown
type QueueItemsMock = (
  queues: unknown,
  date: string,
  refetchInterval?: number,
  options?: { enabled?: boolean },
) => unknown
type QueueCarryOverMock = (date: string) => {
  isSuccess: boolean
  isPending: boolean
  isError: boolean
  error: unknown
  isToday: boolean
  canReadQueueItems: boolean
}
type QueueDatesMock = (
  key: string | undefined,
  dates: string[],
  refetchInterval?: number,
) => unknown
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
  onVisibleRangeChange?: (range: { start: Date; end: Date }) => void
  dndCallbacks?: CalendarDndCallbacks
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

function isDueTaskQuery(filter: unknown): boolean {
  return (
    typeof filter === 'object' &&
    filter !== null &&
    'hasDue' in filter &&
    filter.hasDue === true
  )
}

const mocks = vi.hoisted(() => ({
  useTaskList: vi.fn<TaskListMock>(),
  useTimeBlocks: vi.fn<DateRangeQueryMock>(),
  useScheduleList: vi.fn<DateRangeQueryMock>(),
  useGcalEvents: vi.fn<GcalQueryMock>(),
  useMemos: vi.fn<MemosMock>(),
  useQueues: vi.fn<QueueListMock>(),
  useQueueItemsForQueues: vi.fn<QueueItemsMock>(),
  useQueueCarryOver: vi.fn<QueueCarryOverMock>(),
  selectedDate: null as Date | null,
  useQueueItemsForDates: vi.fn<QueueDatesMock>(),
  fetchQueueItems: vi.fn<(key: string, date: string) => Promise<QueueItem[]>>(),
  setQueueItems:
    vi.fn<
      (
        variables: QueueMutationVariables,
        options?: QueueMutationOptions,
      ) => void
    >(),
  createTimeBlock: vi.fn<(input: unknown) => void>(),
  dayViewProps: vi.fn<(props: DayViewMockProps) => void>(),
}))

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

vi.mock('#hooks/use-auto-assign', () => ({
  useAutoAssign: () => ({ isPending: false, mutate: vi.fn() }),
}))

vi.mock('#hooks/use-calendar-change-feedback', () => ({
  useCalendarChangeFeedback: () => ({
    changeFeedback: null,
    changeFeedbackAnchorRef: { current: null },
    handleTimeBlockChange: vi.fn(),
    dismissChangeFeedback: vi.fn(),
  }),
}))

vi.mock('#hooks/use-current-context', () => ({
  useCurrentContext: () => 'work',
}))

vi.mock('#hooks/use-filtered-tasks', () => ({
  useBaseFilter: () => ({}),
}))

vi.mock('#hooks/use-gcal-events', () => ({
  GcalAuthRequiredError: class extends Error {},
  useAutoRescheduleOnGcalChange: vi.fn(),
  useGcalEvents: (...args: Parameters<GcalQueryMock>) => {
    mocks.useGcalEvents(...args)
    return { data: [], error: null }
  },
}))

vi.mock('#hooks/use-github-link', () => ({ useGithubSync: () => {} }))

vi.mock('#hooks/use-integrations', () => ({
  useIntegrationAuthUrl: () => ({ data: undefined }),
}))

vi.mock('#hooks/use-memos', () => ({
  useMemos: (...args: Parameters<MemosMock>) => mocks.useMemos(...args),
  useUpdateMemo: () => ({ mutateAsync: vi.fn() }),
}))

vi.mock('#hooks/use-projects', () => ({
  useProjects: () => ({ data: [] }),
}))

vi.mock('#hooks/use-push-notifications', () => ({
  usePushResubscribe: () => {},
}))

vi.mock('#hooks/use-queues', () => ({
  DAY_QUEUE_KEY: 'day',
  WEEK_QUEUE_KEY: 'week',
  queueKeys: {
    all: ['queues'],
    items: (key: string, date: string) => ['queues', key, 'items', date],
  },
  useQueueItemsForQueues: (...args: Parameters<QueueItemsMock>) =>
    mocks.useQueueItemsForQueues(...args),
  useQueueCarryOver: (...args: Parameters<QueueCarryOverMock>) =>
    mocks.useQueueCarryOver(...args),
  useQueueItemsForDates: (...args: Parameters<QueueDatesMock>) =>
    mocks.useQueueItemsForDates(...args),
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

vi.mock('#hooks/use-scheduling-settings', () => ({
  useSchedulingSettings: () => ({
    data: { autoRescheduleOnGcalChange: false },
  }),
}))

vi.mock('#hooks/use-selected-date', () => ({
  useSelectedDate: () => ({
    selectedDate: mocks.selectedDate ?? new Date('2026-07-20T00:00:00'),
    setSelectedDate: vi.fn(),
  }),
}))

vi.mock('#hooks/use-service-worker-update', () => ({
  useServiceWorkerUpdate: () => {},
}))

vi.mock('#hooks/use-tasks', () => ({
  useTaskList: (...args: Parameters<TaskListMock>) =>
    mocks.useTaskList(...args),
  useTaskMap: () => new Map(),
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

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...rendered, queryClient, router }
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
  mocks.useQueueCarryOver.mockImplementation((date) => {
    const isToday = date === formatLocalDate(new Date())
    return {
      isSuccess: true,
      isPending: false,
      isError: false,
      error: null,
      isToday,
      canReadQueueItems: true,
    }
  })
  mocks.selectedDate = null
  mocks.useQueueItemsForDates.mockReturnValue([])
  mocks.fetchQueueItems.mockResolvedValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
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
      isToday: true,
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
          undefined,
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
      isToday: true,
      canReadQueueItems: true,
    })

    const { queryClient } = await renderDayRoute('/')

    await waitFor(() => {
      expect(mocks.useQueueItemsForQueues.mock.calls.at(-1)).toEqual([
        [],
        todayStr,
        undefined,
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
        [[], pastDateStr, undefined, { enabled: true }],
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
        [[], futureDateStr, undefined, { enabled: true }],
      ])
    })

    queryClient.clear()
  })

  it('activates the compact shell and polls every visible data query from the URL', async () => {
    const { queryClient, router } = await renderDayRoute('/?layout=compact')
    const nowPanelRange = getNowPanelQueryDateRange(new Date())
    const getCompactRouteState = () => ({
      pathname: router.state.location.pathname,
      layout: screen.getByTestId('day-view').getAttribute('data-layout'),
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      taskListInterval: mocks.useTaskList.mock.calls[0]?.[1]?.refetchInterval,
      dueTaskFilter: mocks.useTaskList.mock.calls[1]?.[0],
      dueTaskOptions: mocks.useTaskList.mock.calls[1]?.[1],
      timeBlocksInterval: mocks.useTimeBlocks.mock.calls[0]?.[2],
      schedulesInterval: mocks.useScheduleList.mock.calls[0]?.[2],
      memoArgs: mocks.useMemos.mock.calls.at(-1),
      nowPanelTimeBlocksRange: mocks.useTimeBlocks.mock.calls
        .find((call) => call[3] === true)
        ?.slice(0, 2),
      nowPanelSchedulesRange: mocks.useScheduleList.mock.calls
        .find((call) => call[3] === true)
        ?.slice(0, 2),
      nowPanelGcalRange: mocks.useGcalEvents.mock.calls
        .find((call) => call[3] === true)
        ?.slice(0, 2),
      queuesInterval: mocks.useQueues.mock.calls[0]?.[0],
      queueItemsInterval: mocks.useQueueItemsForQueues.mock.calls[0]?.[2],
    })

    await waitFor(() => {
      expect(getCompactRouteState()).toEqual({
        pathname: '/',
        layout: 'compact',
        appLayoutVisible: false,
        taskListInterval: 60_000,
        dueTaskFilter: { status: 'todo', hasDue: true, sortBy: 'due' },
        dueTaskOptions: { enabled: true, refetchInterval: 60_000 },
        timeBlocksInterval: 60_000,
        schedulesInterval: 60_000,
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
        queuesInterval: 60_000,
        queueItemsInterval: 60_000,
      })
    })

    queryClient.clear()
  })

  it('keeps the default shell and does not poll when compact mode is absent', async () => {
    const { queryClient, router } = await renderDayRoute('/?layout=unsupported')
    const getDefaultRouteState = () => ({
      pathname: router.state.location.pathname,
      layout: screen.getByTestId('day-view').getAttribute('data-layout'),
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      taskListInterval: mocks.useTaskList.mock.calls[0]?.[1]?.refetchInterval,
      dueTaskFilter: mocks.useTaskList.mock.calls[1]?.[0],
      dueTaskOptions: mocks.useTaskList.mock.calls[1]?.[1],
      timeBlocksInterval: mocks.useTimeBlocks.mock.calls[0]?.[2],
      schedulesInterval: mocks.useScheduleList.mock.calls[0]?.[2],
      memoArgs: mocks.useMemos.mock.calls.at(-1),
      nowPanelTimeBlocksEnabled: mocks.useTimeBlocks.mock.calls.some(
        (call) => call[3] === false,
      ),
      nowPanelSchedulesEnabled: mocks.useScheduleList.mock.calls.some(
        (call) => call[3] === false,
      ),
      nowPanelGcalEnabled: mocks.useGcalEvents.mock.calls.some(
        (call) => call[3] === false,
      ),
      queuesInterval: mocks.useQueues.mock.calls[0]?.[0],
      queueItemsInterval: mocks.useQueueItemsForQueues.mock.calls[0]?.[2],
    })

    await waitFor(() => {
      expect(getDefaultRouteState()).toEqual({
        pathname: '/',
        layout: 'default',
        appLayoutVisible: true,
        taskListInterval: undefined,
        dueTaskFilter: { status: 'todo', hasDue: true, sortBy: 'due' },
        dueTaskOptions: { enabled: false },
        timeBlocksInterval: undefined,
        schedulesInterval: undefined,
        memoArgs: ['work', false],
        nowPanelTimeBlocksEnabled: true,
        nowPanelSchedulesEnabled: true,
        nowPanelGcalEnabled: true,
        queuesInterval: undefined,
        queueItemsInterval: undefined,
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

describe('day queue calendar interactions', () => {
  it('loads a day queue for every date in the visible calendar range', async () => {
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
      expect(mocks.useQueueItemsForDates.mock.lastCall).toEqual([
        'day',
        ['2026-07-19', '2026-07-20', '2026-07-21', '2026-07-22'],
        undefined,
      ])
    })
    queryClient.clear()
  })

  it('logs each visible day queue query error once', async () => {
    const error = new Error('day queue unavailable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useQueues.mockReturnValue({
      data: [makeQueue({ key: 'day', name: 'today' })],
    })
    mocks.useQueueItemsForDates.mockImplementation((_key, dates) =>
      dates.map(() => ({ data: undefined, error, errorUpdatedAt: 1 })),
    )

    const { queryClient } = await renderDayRoute('/')
    const getActual = () => consoleError.mock.calls

    await waitFor(() => {
      const dates = assertDefined(mocks.useQueueItemsForDates.mock.lastCall)[1]
      expect(getActual()).toEqual(
        dates.map((date) => [
          'Failed to refresh calendar day queue items',
          { date, error },
        ]),
      )
    })
    queryClient.clear()
  })

  it('moves a queued task to another day and removes it from its source day', async () => {
    const sourceDate = '2026-07-20'
    const targetDate = '2026-07-21'
    const taskId = 'queued-sample-a'
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

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
) => unknown
type QueueListMock = (refetchInterval?: number) => unknown
type QueueItemsMock = (
  queues: unknown,
  date: string,
  refetchInterval?: number,
) => unknown

const mocks = vi.hoisted(() => ({
  useTaskList: vi.fn<TaskListMock>(),
  useTimeBlocks: vi.fn<DateRangeQueryMock>(),
  useScheduleList: vi.fn<DateRangeQueryMock>(),
  useQueues: vi.fn<QueueListMock>(),
  useQueueItemsForQueues: vi.fn<QueueItemsMock>(),
}))

vi.mock('#components/calendar/calendar-change-feedback-popup', () => ({
  CalendarChangeFeedbackPopup: () => null,
}))

vi.mock('#components/day-view/day-view', () => ({
  DayViewPresentation: ({ layout }: { layout?: string }) => (
    <div data-testid="day-view" data-layout={layout} />
  ),
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
  useCurrentContext: () => null,
}))

vi.mock('#hooks/use-filtered-tasks', () => ({
  useBaseFilter: () => ({}),
}))

vi.mock('#hooks/use-gcal-events', () => ({
  GcalAuthRequiredError: class extends Error {},
  useAutoRescheduleOnGcalChange: vi.fn(),
  useGcalEvents: () => ({ data: [], error: null }),
}))

vi.mock('#hooks/use-github-link', () => ({ useGithubSync: () => {} }))

vi.mock('#hooks/use-integrations', () => ({
  useIntegrationAuthUrl: () => ({ data: undefined }),
}))

vi.mock('#hooks/use-projects', () => ({
  useProjects: () => ({ data: [] }),
}))

vi.mock('#hooks/use-push-notifications', () => ({
  usePushResubscribe: () => {},
}))

vi.mock('#hooks/use-queues', () => ({
  DAY_QUEUE_KEY: 'day',
  queueKeys: {
    items: (key: string, date: string) => ['queues', key, 'items', date],
  },
  useQueueItemsForQueues: (...args: Parameters<QueueItemsMock>) =>
    mocks.useQueueItemsForQueues(...args),
  useQueues: (...args: Parameters<QueueListMock>) => mocks.useQueues(...args),
  useSetQueueItems: () => ({ isPending: false, mutate: vi.fn() }),
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
    selectedDate: new Date('2026-07-20T00:00:00'),
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
  useCreateTimeBlock: () => ({ mutate: vi.fn() }),
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
  mocks.useQueues.mockReturnValue({ data: [] })
  mocks.useQueueItemsForQueues.mockReturnValue([])
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('day-view route compact layout', () => {
  it('activates the compact shell and polls every visible data query from the URL', async () => {
    const { queryClient, router } = await renderDayRoute('/?layout=compact')
    const getCompactRouteState = () => ({
      pathname: router.state.location.pathname,
      layout: screen.getByTestId('day-view').getAttribute('data-layout'),
      appLayoutVisible: screen.queryByTestId('app-layout') != null,
      taskListInterval: mocks.useTaskList.mock.calls[0]?.[1]?.refetchInterval,
      timeBlocksInterval: mocks.useTimeBlocks.mock.calls[0]?.[2],
      schedulesInterval: mocks.useScheduleList.mock.calls[0]?.[2],
      queuesInterval: mocks.useQueues.mock.calls[0]?.[0],
      queueItemsInterval: mocks.useQueueItemsForQueues.mock.calls[0]?.[2],
    })

    await waitFor(() => {
      expect(getCompactRouteState()).toEqual({
        pathname: '/',
        layout: 'compact',
        appLayoutVisible: false,
        taskListInterval: 60_000,
        timeBlocksInterval: 60_000,
        schedulesInterval: 60_000,
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
      timeBlocksInterval: mocks.useTimeBlocks.mock.calls[0]?.[2],
      schedulesInterval: mocks.useScheduleList.mock.calls[0]?.[2],
      queuesInterval: mocks.useQueues.mock.calls[0]?.[0],
      queueItemsInterval: mocks.useQueueItemsForQueues.mock.calls[0]?.[2],
    })

    await waitFor(() => {
      expect(getDefaultRouteState()).toEqual({
        pathname: '/',
        layout: 'default',
        appLayoutVisible: true,
        taskListInterval: undefined,
        timeBlocksInterval: undefined,
        schedulesInterval: undefined,
        queuesInterval: undefined,
        queueItemsInterval: undefined,
      })
    })

    queryClient.clear()
  })

  it('logs compact calendar refresh errors', async () => {
    const timeBlocksError = new Error('time blocks unavailable')
    const schedulesError = new Error('schedules unavailable')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    mocks.useTimeBlocks.mockReturnValue({ data: [], error: timeBlocksError })
    mocks.useScheduleList.mockReturnValue({ data: [], error: schedulesError })

    const { queryClient } = await renderDayRoute('/?layout=compact')
    const getLoggedErrors = () => consoleError.mock.calls

    await waitFor(() => {
      expect(getLoggedErrors()).toEqual([
        ['Failed to refresh time blocks in compact layout', timeBlocksError],
        ['Failed to refresh schedules in compact layout', schedulesError],
      ])
    })

    queryClient.clear()
  })
})

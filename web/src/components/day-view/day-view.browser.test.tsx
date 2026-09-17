import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from '@vitest/browser/context'
import { describe, expect, it, vi } from 'vitest'

import {
  DayViewPresentation,
  type DayViewPresentationProps,
  estimateMinutesForRange,
} from '#components/day-view/day-view'
import { makeSchedule } from '#components/schedule/schedule-test-fixtures'
import { assertDefined, findVisible } from '#lib/test-utils'
import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

describe('estimateMinutesForRange', () => {
  it('uses the selected range length when it is at least 30 minutes', () => {
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T10:00:00')

    expect(estimateMinutesForRange({ start, end })).toBe(60)
  })

  it('clamps a shorter selection (e.g. a plain click) up to 30 minutes', () => {
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T09:15:00')

    expect(estimateMinutesForRange({ start, end })).toBe(30)
  })
})

let capturedOnSelectRange:
  ((info: { start: Date; end: Date }) => void) | undefined
let capturedOnTaskClick: ((taskId: string) => void) | undefined
let capturedOnScheduleClick:
  ((scheduleId: string, start: string) => void) | undefined
let capturedModalProps: {
  open: boolean
  defaultStartDate?: string
  defaultEstimateMinutes?: number
  onCreated?: (task: { id: string }) => void
} = { open: false }

vi.mock('#components/calendar/calendar-view', () => ({
  CalendarView: (props: {
    onSelectRange?: (info: { start: Date; end: Date }) => void
    onTaskClick?: (taskId: string) => void
    onScheduleClick?: (scheduleId: string, start: string) => void
  }) => {
    capturedOnSelectRange = props.onSelectRange
    capturedOnTaskClick = props.onTaskClick
    capturedOnScheduleClick = props.onScheduleClick
    return null
  },
}))

vi.mock('#components/task/create-task-modal', () => ({
  CreateTaskModal: (props: typeof capturedModalProps) => {
    capturedModalProps = props
    return null
  },
}))

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderDayView(
  overrides: Partial<DayViewPresentationProps> = {},
  onCreateTimeBlock = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const props: DayViewPresentationProps = {
    isLoading: false,
    calendarEvents: [],
    schedules: [],
    onCreateTimeBlock,
    queueSections: [],
    dayQueueTasks: [],
    queueCandidates: [],
    onReorderQueue: vi.fn(),
    onMoveTask: vi.fn(),
    onInsertCandidate: vi.fn(),
    onAddCandidate: vi.fn(),
    onRemoveFromQueue: vi.fn(),
    onAutoAssign: vi.fn(),
    isAutoAssigning: false,
    selectedDate: new Date('2026-07-20T00:00:00'),
    onDateChange: vi.fn(),
    viewMode: 'queue',
    onViewModeChange: vi.fn(),
    ...overrides,
  }
  const rootRoute = createRootRoute({
    component: () => <DayViewPresentation {...props} />,
  })
  // The navigation target — a no-op component, matching how
  // StoryRouter/tree-task-grid-row.test.tsx register targets.
  const taskDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([taskDetailRoute])
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { onCreateTimeBlock, router }
}

describe('DayViewPresentation', () => {
  it('prefills the modal from a calendar selection and creates a time block once the task is created', async () => {
    const { onCreateTimeBlock } = await renderDayView()
    const start = new Date('2026-07-20T09:00:00')
    const end = new Date('2026-07-20T10:00:00')

    act(() => {
      capturedOnSelectRange?.({ start, end })
    })

    expect(capturedModalProps.open).toBe(true)
    expect(capturedModalProps.defaultStartDate).toBe('2026-07-20')
    expect(capturedModalProps.defaultEstimateMinutes).toBe(60)

    act(() => {
      capturedModalProps.onCreated?.({ id: 'task-1' })
    })

    expect(onCreateTimeBlock).toHaveBeenCalledExactlyOnceWith({
      taskId: 'task-1',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
    })
  })

  it('does not create a time block when the task is created from the "New task" button', async () => {
    const user = userEvent.setup()
    const { onCreateTimeBlock } = await renderDayView()

    await user.click(screen.getByLabelText('New task'))
    act(() => {
      capturedModalProps.onCreated?.({ id: 'task-2' })
    })

    expect(onCreateTimeBlock).not.toHaveBeenCalled()
  })

  it('navigates to the task detail route when a calendar task event is clicked', async () => {
    const { router } = await renderDayView()

    act(() => {
      capturedOnTaskClick?.('task-42')
    })

    expect(router.state.location.pathname).toBe('/tasks/task-42')
  })

  it('opens the real CreateScheduleModal when the "New schedule" button is clicked', async () => {
    const user = userEvent.setup()
    await renderDayView()

    await user.click(screen.getByLabelText('New schedule'))

    // CreateScheduleModal always renders both its desktop and mobile panels
    // and lets CSS pick which is shown, so the "Schedule title" input exists
    // twice — only the one matching the current viewport is visible.
    const titleInputs = await screen.findAllByPlaceholderText('Schedule title')
    expect(
      assertDefined(
        findVisible(titleInputs),
        'no visible "Schedule title" input found',
      ),
    ).toBeVisible()
  })

  it('opens the CreateTaskModal when the "New task" button is clicked', async () => {
    const user = userEvent.setup()
    await renderDayView()

    await user.click(screen.getByLabelText('New task'))

    expect(capturedModalProps.open).toBe(true)
  })

  it('opens the real CreateScheduleModal pre-filled when a calendar schedule block is clicked', async () => {
    const schedule = makeSchedule({
      scheduleId: 'sched-sleep',
      title: 'Sleep',
      start: '2026-07-20T00:00:00',
      end: '2026-07-20T07:00:00',
    })
    await renderDayView({ schedules: [schedule] })

    act(() => {
      capturedOnScheduleClick?.('sched-sleep', schedule.start)
    })

    const titleInputs = await screen.findAllByPlaceholderText('Schedule title')
    expect(
      assertDefined(
        findVisible(titleInputs),
        'no visible "Schedule title" input found',
      ),
    ).toHaveValue('Sleep')
  })

  it('has no reachable mobile Layout action-sheet trigger while the calendar tab is active', async () => {
    await renderDayView()

    expect(
      document.body.querySelector('[data-slot="action-sheet-trigger"]'),
    ).not.toBeInTheDocument()
  })

  it('switches to the tasks pane when the mobile "tasks" tab is clicked', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const user = userEvent.setup()
    await renderDayView()

    expect(
      document.body.querySelector('[data-slot="action-sheet-trigger"]'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'tasks' }))

    expect(
      document.body.querySelector('[data-slot="action-sheet-trigger"]'),
    ).toBeInTheDocument()
  })

  it('reveals the "List"/"Board" layout picker items once the mobile tasks tab is active', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const user = userEvent.setup()
    await renderDayView({ initialMobileTab: 'tasks' })

    const trigger = assertDefined(
      document.body.querySelector<HTMLElement>(
        '[data-slot="action-sheet-trigger"]',
      ),
      'mobile layout trigger not found',
    )
    await user.click(trigger)

    expect(await screen.findByText('List')).toBeInTheDocument()
    expect(screen.getByText('Board')).toBeInTheDocument()
  })
})

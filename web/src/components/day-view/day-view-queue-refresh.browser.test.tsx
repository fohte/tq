import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { act, render, screen, waitFor } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { makeTimeBlockEvent } from '#components/calendar/time-block-event-test-fixtures'
import { DayViewPresentation } from '#components/day-view/day-view'
import type { NowPanelProps } from '#components/day-view/now-panel'
import { makeQueueSectionData } from '#components/day-view/queue-pane-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeMemo } from '#hooks/memo-test-fixtures'
import { formatLocalDate } from '#lib/date-range'

vi.mock('#components/ui/markdown-editor', () => ({
  MarkdownEditor: () => <div className="compact-memo-editor" />,
}))

const queueTasks = Array.from({ length: 5 }, (_, index) =>
  makeTask({
    id: `queued-task-${String(index + 1)}`,
    title: `Queued task ${String(index + 1)}`,
  }),
)

const queueTaskCountsByDate = new Map([
  [20, 0],
  [21, 1],
  [22, 5],
  [23, 0],
])

function tasksForDate(date: Date) {
  const count = queueTaskCountsByDate.get(date.getDate()) ?? 0
  return queueTasks.slice(0, count)
}

function makeNowPanelProps(
  activityCount: number,
  includeNextEvent: boolean,
  desktopWindowControls: boolean,
): NowPanelProps {
  return {
    desktopWindowControls,
    model: {
      activities: Array.from({ length: activityCount }, (_, index) => ({
        kind: 'task' as const,
        key: `activity-${String(index + 1)}`,
        task: makeTask({
          id: `current-activity-${String(index + 1)}`,
          title:
            index === 0
              ? 'Confirm supplier pricing'
              : index === 1
                ? 'Review the launch checklist'
                : `Current activity ${String(index + 1)}`,
        }),
        blockEnd: '2026-07-22T10:00:00.000Z',
        statusLabel: 'in progress',
        isOverrun: false,
      })),
      emptyState: activityCount === 0 ? 'no-time-blocks-today' : null,
      nextEvent: includeNextEvent
        ? { title: 'Upcoming activity', minutesUntil: 45, isWarning: false }
        : null,
    },
  }
}

interface QueueRefreshController {
  finish: (() => void) | undefined
}

interface CompactScenario {
  initialDate: Date
  windowHeight: number
  windowWidth: number | undefined
  nowActivityCount: number
  includeNextEvent: boolean
  includeNowPanel: boolean
  desktopWindowControls: boolean
  includeCompactMemo: boolean
  includeAllDayEvent: boolean
  registerRefreshCompletion: (finish: () => void) => void
}

type CompactRenderOptions = Partial<
  Omit<CompactScenario, 'registerRefreshCompletion'>
> & {
  viewportHeight?: number
  viewportWidth?: number
  registerRefreshCompletion?: (finish: () => void) => void
}

function CompactDayView({ scenario }: { scenario: CompactScenario }) {
  const {
    initialDate,
    windowHeight,
    windowWidth,
    nowActivityCount,
    includeNextEvent,
    includeNowPanel,
    desktopWindowControls,
    includeCompactMemo,
    includeAllDayEvent,
    registerRefreshCompletion,
  } = scenario
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [visibleQueueTasks, setVisibleQueueTasks] = useState(() =>
    tasksForDate(initialDate),
  )
  const [isQueueRefreshing, setIsQueueRefreshing] = useState(false)
  registerRefreshCompletion(() => {
    setVisibleQueueTasks(tasksForDate(selectedDate))
    setIsQueueRefreshing(false)
  })
  const allDayEventEnd = new Date(initialDate)
  allDayEventEnd.setDate(allDayEventEnd.getDate() + 1)

  return (
    <div
      data-testid="compact-window"
      className={windowWidth == null ? undefined : 'mx-auto'}
      style={{
        height: windowHeight,
        ...(windowWidth == null
          ? {}
          : { width: windowWidth, maxWidth: '100%' }),
      }}
    >
      <DayViewPresentation
        isLoading={false}
        isQueueRefreshing={isQueueRefreshing}
        layout="compact"
        calendarEvents={
          includeAllDayEvent
            ? [
                makeTimeBlockEvent({
                  id: 'compact-all-day-event',
                  title: 'All-day item',
                  start: formatLocalDate(initialDate),
                  end: formatLocalDate(allDayEventEnd),
                  type: 'schedule',
                  allDay: true,
                }),
              ]
            : []
        }
        schedules={[]}
        {...(includeNowPanel
          ? {
              nowPanel: makeNowPanelProps(
                nowActivityCount,
                includeNextEvent,
                desktopWindowControls,
              ),
            }
          : {})}
        onCreateTimeBlock={() => {}}
        queueSections={[
          makeQueueSectionData({
            key: 'day',
            title: 'today',
            items: visibleQueueTasks,
            emptyMessage: 'No tasks are queued',
          }),
        ]}
        dayQueueTasks={visibleQueueTasks}
        queueCandidates={[]}
        onMoveTask={() => {}}
        onInsertCandidate={() => {}}
        onAddCandidate={() => {}}
        onRemoveFromQueue={() => {}}
        onMoveScheduledTaskToWeek={() => {}}
        selectedDate={selectedDate}
        onDateChange={(date) => {
          setSelectedDate(date)
          setIsQueueRefreshing(true)
        }}
        viewMode="queue"
        onViewModeChange={() => {}}
        {...(includeCompactMemo
          ? {
              compactMemo: {
                context: 'work' as const,
                memo: makeMemo({ content: '- A note for the compact window' }),
                isLoading: false,
                loadError: false,
                onSave: () => Promise.resolve(makeMemo()),
              },
            }
          : {})}
      />
    </div>
  )
}

async function renderCompactDayView(options: CompactRenderOptions = {}) {
  const {
    viewportHeight,
    viewportWidth,
    registerRefreshCompletion,
    ...scenarioOverrides
  } = options
  const scenario: CompactScenario = {
    initialDate: new Date('2026-07-20T00:00:00'),
    windowHeight: 820,
    windowWidth: undefined,
    nowActivityCount: 0,
    includeNextEvent: false,
    includeNowPanel: true,
    desktopWindowControls: false,
    includeCompactMemo: false,
    includeAllDayEvent: false,
    ...scenarioOverrides,
    registerRefreshCompletion: registerRefreshCompletion ?? (() => {}),
  }
  const height = viewportHeight ?? scenario.windowHeight
  const width = viewportWidth ?? 760

  await page.viewport(width, height)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <CompactDayView scenario={scenario} />,
  })
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

function finishQueueRefresh(controller: QueueRefreshController) {
  const finish = controller.finish
  if (finish == null) {
    throw new Error('The queue refresh completion is missing')
  }
  act(finish)
}

function readNavigationVerticalPositions() {
  const readButtonPosition = (name: 'Previous' | 'Next') => {
    const button = document.querySelector<HTMLButtonElement>(
      `[aria-label="${name}"]`,
    )
    if (button == null) throw new Error(`The ${name} button is missing`)
    return Math.round(button.getBoundingClientRect().y)
  }

  return {
    previous: readButtonPosition('Previous'),
    next: readButtonPosition('Next'),
  }
}

function readPinnedHeaderPositions() {
  const nowPanel = document.querySelector('[aria-label="Now"]')
  if (nowPanel == null) throw new Error('The Now panel is missing')
  return {
    now: Math.round(nowPanel.getBoundingClientRect().y),
    navigation: readNavigationVerticalPositions(),
  }
}

function readDesktopCompactHeaderOrder() {
  const titlebar = screen.getByTestId('compact-titlebar-bar')
  const navigation = document.querySelector<HTMLButtonElement>(
    '[aria-label="Previous"]',
  )
  const nowPanel = screen.queryByRole('region', { name: 'Now' })
  if (navigation == null) throw new Error('The Previous button is missing')
  if (nowPanel == null) throw new Error('The Now panel is missing')

  const titlebarBounds = titlebar.getBoundingClientRect()
  const navigationBounds = navigation.getBoundingClientRect()
  const nowBounds = nowPanel.getBoundingClientRect()
  return {
    titlebarAboveDate: titlebarBounds.bottom <= navigationBounds.top,
    dateAboveNow: navigationBounds.bottom <= nowBounds.top,
  }
}

function readDesktopCompactHeaderOrderWithoutNow() {
  const titlebar = screen.getByTestId('compact-titlebar-bar')
  const navigation = document.querySelector<HTMLButtonElement>(
    '[aria-label="Previous"]',
  )
  const queueContent = screen.getByTestId('compact-queue-content')
  if (navigation == null) throw new Error('The Previous button is missing')

  const titlebarBounds = titlebar.getBoundingClientRect()
  const navigationBounds = navigation.getBoundingClientRect()
  const queueBounds = queueContent.getBoundingClientRect()
  return {
    titlebarAboveDate: titlebarBounds.bottom <= navigationBounds.top,
    dateAboveQueue: navigationBounds.bottom <= queueBounds.top,
  }
}

function mockDesktopUserAgent() {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.navigator,
    'userAgent',
  )
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'TQDesktop',
  })

  return () => {
    if (descriptor == null) {
      Reflect.deleteProperty(window.navigator, 'userAgent')
    } else {
      Object.defineProperty(window.navigator, 'userAgent', descriptor)
    }
  }
}

function readQueueScrollLayout(scrollPane: HTMLElement) {
  return {
    scrolled: scrollPane.scrollTop > 0,
    pinnedPositions: readPinnedHeaderPositions(),
  }
}

async function scrollQueueWhileHeaderStaysPinned() {
  const scrollPane = screen.getByTestId('compact-queue-content')
  scrollPane.scrollTop = scrollPane.scrollHeight

  await waitFor(() => {
    if (scrollPane.scrollTop === 0) {
      throw new Error('The queue did not scroll')
    }
  })

  return readQueueScrollLayout(scrollPane)
}

async function resizeCompactWindow(height: number) {
  const queueContent = screen.getByTestId('compact-queue-content')
  const previousQueueHeight = queueContent.clientHeight
  screen.getByTestId('compact-window').style.height = `${String(height)}px`
  await page.viewport(760, height)
  await waitFor(() => {
    if (queueContent.clientHeight === previousQueueHeight) {
      throw new Error('The compact queue scroll area has not resized')
    }
  })
}

function getCompactUpperPane() {
  const pane = screen.getByTestId('compact-upper-pane')
  if (!(pane instanceof HTMLElement)) {
    throw new Error('The compact upper pane is missing')
  }
  return pane
}

async function scrollQueueContentToTask(taskTitle = 'Queued task 1') {
  const pane = screen.getByTestId('compact-queue-content')
  if (!(pane instanceof HTMLElement)) {
    throw new Error('The compact queue content is missing')
  }
  await waitFor(() => {
    if (pane.clientHeight === 0 || pane.scrollHeight <= pane.clientHeight) {
      throw new Error('The compact queue content has no scrollable overflow')
    }
  })
  pane.scrollTop = pane.scrollHeight

  const task = screen.getByText(taskTitle)
  const paneBounds = pane.getBoundingClientRect()
  const taskBounds = task.getBoundingClientRect()
  pane.scrollTop += taskBounds.top - paneBounds.top
  await waitFor(() => {
    const currentPaneBounds = pane.getBoundingClientRect()
    const currentTaskBounds = task.getBoundingClientRect()
    if (
      pane.scrollTop === 0 ||
      currentTaskBounds.bottom <= currentPaneBounds.top ||
      currentTaskBounds.top >= currentPaneBounds.bottom
    ) {
      throw new Error('The queue task is not visible in its scroll area')
    }
  })
  const finalPaneBounds = pane.getBoundingClientRect()
  const finalTaskBounds = task.getBoundingClientRect()
  return {
    queueContentScrolled: pane.scrollTop > 0,
    queueTaskVisible:
      finalTaskBounds.bottom > finalPaneBounds.top &&
      finalTaskBounds.top < finalPaneBounds.bottom,
  }
}

function readWindowResizeLayout(
  expandedWindow: ReturnType<typeof readQueueScrollLayout>,
  shortWindow: Awaited<ReturnType<typeof scrollQueueContentToTask>>,
) {
  return { expandedWindow, shortWindow }
}

function readShortWindowLayout(
  queueContent: Awaited<ReturnType<typeof scrollQueueContentToTask>>,
) {
  const pane = getCompactUpperPane()
  const nowPanel = screen.getByRole('region', { name: 'Now' })
  const allDayBounds = screen.getByText('All-day item').getBoundingClientRect()
  const nowBounds = nowPanel.getBoundingClientRect()
  const paneBounds = pane.getBoundingClientRect()
  const navigationButton = document.querySelector<HTMLButtonElement>(
    '[aria-label="Previous"]',
  )
  if (navigationButton == null) {
    throw new Error('The Previous button is missing')
  }
  const navigationBounds = navigationButton.getBoundingClientRect()
  return {
    queueContentScrolled: queueContent.queueContentScrolled,
    queueTaskVisible: queueContent.queueTaskVisible,
    dateNavigationVisible:
      navigationBounds.top >= paneBounds.top &&
      navigationBounds.bottom <= paneBounds.bottom,
    allDayRowBelowUpperPane: allDayBounds.top >= paneBounds.bottom,
    allDayRowDoesNotOverlapNow:
      allDayBounds.bottom <= nowBounds.top ||
      allDayBounds.top >= nowBounds.bottom,
  }
}

function isFullyVisibleWithin(element: HTMLElement, container: HTMLElement) {
  const elementBounds = element.getBoundingClientRect()
  const containerBounds = container.getBoundingClientRect()
  return (
    elementBounds.height > 0 &&
    elementBounds.top >= containerBounds.top &&
    elementBounds.bottom <= containerBounds.bottom
  )
}

function readCompactReadableLayout() {
  const pane = getCompactUpperPane()
  const nowContent = screen.getByTestId('now-panel-content')
  const queueContent = screen.getByTestId('compact-queue-content')
  const secondNowTask = screen.getByText('Review the launch checklist')
  const progress = queueContent.firstElementChild
  if (!(progress instanceof HTMLElement)) {
    throw new Error('The compact progress row is missing')
  }
  const firstQueueTask = screen.getByText('Queued task 1')
  const navigation = document.querySelector<HTMLButtonElement>(
    '[aria-label="Previous"]',
  )
  if (navigation == null) throw new Error('The Previous button is missing')

  return {
    dateNavigationVisible: isFullyVisibleWithin(navigation, pane),
    secondNowTaskVisible: isFullyVisibleWithin(secondNowTask, nowContent),
    progressVisible: isFullyVisibleWithin(progress, queueContent),
    firstQueueTaskVisible: isFullyVisibleWithin(firstQueueTask, queueContent),
  }
}

function readTallNowLayout(
  content: HTMLElement,
  initialPositions: ReturnType<typeof readNavigationVerticalPositions>,
) {
  return {
    nowContentScrolled: content.scrollTop > 0,
    navigationPositions: readNavigationVerticalPositions(),
    initialPositions,
    upperPaneScrolled: getCompactUpperPane().scrollTop > 0,
  }
}

async function readQueueWithoutNowLayout() {
  const queueLayout = await scrollQueueContentToTask()
  const paneBounds = getCompactUpperPane().getBoundingClientRect()
  const navigationButton = document.querySelector<HTMLButtonElement>(
    '[aria-label="Previous"]',
  )
  if (navigationButton == null) {
    throw new Error('The Previous button is missing')
  }
  const navigationBounds = navigationButton.getBoundingClientRect()

  return {
    ...queueLayout,
    dateNavigationVisible:
      navigationBounds.top >= paneBounds.top &&
      navigationBounds.bottom <= paneBounds.bottom,
  }
}

function readCompactQueueRefreshLayout(
  initialPositions: ReturnType<typeof readNavigationVerticalPositions>,
) {
  const queuePane = document.querySelector(
    '[data-scroll-restoration-id="day-view"]',
  )
  return {
    isBusy: queuePane?.getAttribute('aria-busy'),
    visibleQueueTaskCount: screen.queryAllByText(/^Queued task \d+$/).length,
    navigationPositions: readNavigationVerticalPositions(),
    initialPositions,
  }
}

describe('DayView compact queue refresh layout', () => {
  it('places desktop window controls and date navigation above Now', async () => {
    await renderCompactDayView({ desktopWindowControls: true })

    await waitFor(() => {
      expect(readDesktopCompactHeaderOrder()).toEqual({
        titlebarAboveDate: true,
        dateAboveNow: true,
      })
    })
  })

  it('omits the desktop titlebar when desktop controls are disabled', async () => {
    await renderCompactDayView({ desktopWindowControls: false })

    expect(screen.queryByTestId('compact-titlebar-bar')).toBeNull()
  })

  it('keeps the desktop titlebar above date navigation when Now is absent', async () => {
    const restoreUserAgent = mockDesktopUserAgent()
    try {
      await renderCompactDayView({ includeNowPanel: false })

      await waitFor(() => {
        expect(readDesktopCompactHeaderOrderWithoutNow()).toEqual({
          titlebarAboveDate: true,
          dateAboveQueue: true,
        })
      })
    } finally {
      restoreUserAgent()
    }
  })

  it('keeps calendar navigation in place for empty, short, and long queues', async () => {
    const refreshController: QueueRefreshController = { finish: undefined }
    await renderCompactDayView({
      registerRefreshCompletion: (finish) => {
        refreshController.finish = finish
      },
    })

    const initialPositions = readNavigationVerticalPositions()
    const transitions = [
      { previousCount: 0, nextCount: 1 },
      { previousCount: 1, nextCount: 5 },
      { previousCount: 5, nextCount: 0 },
    ]

    for (const { previousCount, nextCount } of transitions) {
      await page.getByRole('button', { name: 'Next' }).click()

      await waitFor(() => {
        expect(readCompactQueueRefreshLayout(initialPositions)).toEqual({
          isBusy: 'true',
          visibleQueueTaskCount: previousCount,
          navigationPositions: initialPositions,
          initialPositions,
        })
      })

      finishQueueRefresh(refreshController)

      await waitFor(() => {
        expect(readCompactQueueRefreshLayout(initialPositions)).toEqual({
          isBusy: 'false',
          visibleQueueTaskCount: nextCount,
          navigationPositions: initialPositions,
          initialPositions,
        })
      })
    }
  })

  it('keeps Now and date navigation pinned while the five-task queue scrolls', async () => {
    await renderCompactDayView({
      initialDate: new Date('2026-07-22T00:00:00'),
    })

    const pinnedPositions = readPinnedHeaderPositions()
    const actual = await scrollQueueWhileHeaderStaysPinned()
    const expected = { scrolled: true, pinnedPositions }
    expect(actual).toEqual(expected)
  })

  it('keeps the queue reachable in a short window', async () => {
    await renderCompactDayView({
      initialDate: new Date('2026-07-21T00:00:00'),
      windowHeight: 256,
      viewportHeight: 667,
      viewportWidth: 375,
      windowWidth: 320,
      nowActivityCount: 3,
      includeNextEvent: true,
      includeCompactMemo: true,
      includeAllDayEvent: true,
    })

    const actual = await scrollQueueContentToTask()
    expect(readShortWindowLayout(actual)).toEqual({
      queueContentScrolled: true,
      queueTaskVisible: true,
      dateNavigationVisible: true,
      allDayRowBelowUpperPane: true,
      allDayRowDoesNotOverlapNow: true,
    })
  })

  it.each([
    {
      viewport: 'desktop compact',
      windowHeight: 800,
      viewportHeight: 800,
      viewportWidth: 1280,
      expected: {
        dateNavigationVisible: true,
        secondNowTaskVisible: true,
        progressVisible: true,
        firstQueueTaskVisible: true,
      },
    },
    {
      viewport: 'mobile-height compact',
      windowHeight: 667,
      viewportHeight: 667,
      viewportWidth: 375,
      expected: {
        dateNavigationVisible: true,
        secondNowTaskVisible: true,
        progressVisible: true,
        firstQueueTaskVisible: false,
      },
    },
  ])(
    'keeps navigation, Now, and progress readable in a $viewport window',
    async ({ windowHeight, viewportHeight, viewportWidth, expected }) => {
      await renderCompactDayView({
        initialDate: new Date('2026-07-22T00:00:00'),
        windowHeight,
        viewportHeight,
        viewportWidth,
        windowWidth: 320,
        nowActivityCount: 2,
        includeNextEvent: true,
        includeCompactMemo: true,
      })

      expect(readCompactReadableLayout()).toEqual(expected)
    },
  )

  it('keeps the queue reachable when the Now panel is absent', async () => {
    await renderCompactDayView({
      initialDate: new Date('2026-07-22T00:00:00'),
      includeNowPanel: false,
    })

    expect(await readQueueWithoutNowLayout()).toEqual({
      queueContentScrolled: true,
      queueTaskVisible: true,
      dateNavigationVisible: true,
    })
  })

  it('keeps the date header visible while a tall Now panel scrolls', async () => {
    await renderCompactDayView({
      initialDate: new Date('2026-07-21T00:00:00'),
      nowActivityCount: 10,
    })

    const initialPositions = readNavigationVerticalPositions()
    const content = screen.getByTestId('now-panel-content')
    content.scrollTop = content.scrollHeight
    await waitFor(() => {
      if (content.scrollTop === 0) {
        throw new Error('The Now content did not scroll')
      }
    })

    expect(readTallNowLayout(content, initialPositions)).toEqual({
      nowContentScrolled: true,
      navigationPositions: initialPositions,
      initialPositions,
      upperPaneScrolled: false,
    })
  })

  it('updates the queue scroll area when the window resizes', async () => {
    await renderCompactDayView({
      initialDate: new Date('2026-07-22T00:00:00'),
      windowHeight: 320,
    })

    await resizeCompactWindow(820)

    const pinnedPositions = readPinnedHeaderPositions()
    const expandedWindow = await scrollQueueWhileHeaderStaysPinned()

    await resizeCompactWindow(320)
    const shortWindow = await scrollQueueContentToTask('Queued task 5')
    const actual = readWindowResizeLayout(expandedWindow, shortWindow)
    const expected = {
      expandedWindow: { scrolled: true, pinnedPositions },
      shortWindow: { queueContentScrolled: true, queueTaskVisible: true },
    }
    expect(actual).toEqual(expected)
  })
})

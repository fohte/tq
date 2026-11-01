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
import { describe, expect, it } from 'vitest'

import { DayViewPresentation } from '#components/day-view/day-view'
import { makeQueueSectionData } from '#components/day-view/queue-pane-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'

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

interface QueueRefreshController {
  finish: (() => void) | undefined
}

function CompactDayView({
  initialDate,
  registerRefreshCompletion,
}: {
  initialDate: Date
  registerRefreshCompletion: (finish: () => void) => void
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [visibleQueueTasks, setVisibleQueueTasks] = useState(() =>
    tasksForDate(initialDate),
  )
  const [isQueueRefreshing, setIsQueueRefreshing] = useState(false)
  registerRefreshCompletion(() => {
    setVisibleQueueTasks(tasksForDate(selectedDate))
    setIsQueueRefreshing(false)
  })

  return (
    <div style={{ height: 820 }}>
      <DayViewPresentation
        isLoading={false}
        isQueueRefreshing={isQueueRefreshing}
        layout="compact"
        calendarEvents={[]}
        schedules={[]}
        nowPanel={{
          model: {
            activities: [],
            emptyState: 'no-time-blocks-today',
            nextEvent: null,
          },
        }}
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
      />
    </div>
  )
}

async function renderCompactDayView({
  initialDate = new Date('2026-07-20T00:00:00'),
  registerRefreshCompletion = () => {},
}: {
  initialDate?: Date
  registerRefreshCompletion?: (finish: () => void) => void
} = {}) {
  await page.viewport(760, 820)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => (
      <CompactDayView
        initialDate={initialDate}
        registerRefreshCompletion={registerRefreshCompletion}
      />
    ),
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

function readQueueScrollLayout(scrollPane: HTMLElement) {
  return {
    scrolled: scrollPane.scrollTop > 0,
    pinnedPositions: readPinnedHeaderPositions(),
  }
}

async function scrollQueueWhileHeaderStaysPinned() {
  const scrollPane = document.querySelector(
    '[data-scroll-restoration-id="day-view"]',
  )?.parentElement
  if (scrollPane == null) throw new Error('The queue scroll pane is missing')
  scrollPane.scrollTop = scrollPane.scrollHeight

  await waitFor(() => {
    if (scrollPane.scrollTop === 0) {
      throw new Error('The queue did not scroll')
    }
  })

  return readQueueScrollLayout(scrollPane)
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
})

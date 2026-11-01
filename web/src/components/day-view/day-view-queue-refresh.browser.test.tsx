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

function tasksForDate(date: Date) {
  const count = date.getDate() === 21 ? 1 : date.getDate() === 22 ? 5 : 0
  return queueTasks.slice(0, count)
}

let finishQueueRefresh: (() => void) | undefined

function CompactDayView() {
  const [selectedDate, setSelectedDate] = useState(
    new Date('2026-07-20T00:00:00'),
  )
  const [visibleQueueTasks, setVisibleQueueTasks] = useState(() =>
    tasksForDate(new Date('2026-07-20T00:00:00')),
  )
  const [isQueueRefreshing, setIsQueueRefreshing] = useState(false)
  finishQueueRefresh = () => {
    setVisibleQueueTasks(tasksForDate(selectedDate))
    setIsQueueRefreshing(false)
  }

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
  const pinnedPositions = readPinnedHeaderPositions()
  scrollPane.scrollTop = scrollPane.scrollHeight

  await waitFor(() => {
    const expected = { scrolled: true, pinnedPositions }
    expect(readQueueScrollLayout(scrollPane)).toEqual(expected)
  })
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
    await page.viewport(760, 820)
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const rootRoute = createRootRoute({ component: CompactDayView })
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

    const initialPositions = readNavigationVerticalPositions()

    for (const expectedCount of [1, 5, 0]) {
      await page.getByRole('button', { name: 'Next' }).click()

      await waitFor(() => {
        expect(readCompactQueueRefreshLayout(initialPositions)).toEqual({
          isBusy: 'true',
          visibleQueueTaskCount:
            expectedCount === 1 ? 0 : expectedCount === 5 ? 1 : 5,
          navigationPositions: initialPositions,
          initialPositions,
        })
      })

      act(() => finishQueueRefresh?.())

      await waitFor(() => {
        expect(readCompactQueueRefreshLayout(initialPositions)).toEqual({
          isBusy: 'false',
          visibleQueueTaskCount: expectedCount,
          navigationPositions: initialPositions,
          initialPositions,
        })
      })

      if (expectedCount === 5) {
        await scrollQueueWhileHeaderStaysPinned()
      }
    }
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { DayViewPresentation } from '#components/day-view/day-view'
import { makeQueueSectionData } from '#components/day-view/queue-pane-test-fixtures'
import { makeTask } from '#components/task/task-row-test-fixtures'

const queueTasks = Array.from({ length: 12 }, (_, index) =>
  makeTask({
    id: `queued-task-${String(index + 1)}`,
    title: `Queued task ${String(index + 1)}`,
  }),
)

function CompactDayView() {
  const [selectedDate, setSelectedDate] = useState(
    new Date('2026-07-20T00:00:00'),
  )
  const [isQueueRefreshing, setIsQueueRefreshing] = useState(false)

  return (
    <DayViewPresentation
      isLoading={false}
      isQueueRefreshing={isQueueRefreshing}
      layout="compact"
      calendarEvents={[]}
      schedules={[]}
      onCreateTimeBlock={() => {}}
      queueSections={[
        makeQueueSectionData({
          key: 'day',
          title: 'today',
          items: queueTasks,
          emptyMessage: 'No tasks are queued',
        }),
      ]}
      dayQueueTasks={queueTasks}
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
  )
}

function readNavigationPositions() {
  const readButtonPosition = (name: 'Previous' | 'Next') => {
    const button = document.querySelector<HTMLButtonElement>(
      `[aria-label="${name}"]`,
    )
    if (button == null) throw new Error(`The ${name} button is missing`)
    const { x, y, width, height } = button.getBoundingClientRect()
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    }
  }

  return {
    previous: readButtonPosition('Previous'),
    next: readButtonPosition('Next'),
  }
}

function readCompactQueueRefreshLayout(
  initialPositions: ReturnType<typeof readNavigationPositions>,
) {
  const queuePane = document.querySelector(
    '[data-scroll-restoration-id="day-view"]',
  )
  return {
    isBusy: queuePane?.getAttribute('aria-busy'),
    visibleTask: screen.getByText('Queued task 1').textContent,
    navigationPositions: readNavigationPositions(),
    initialPositions,
  }
}

describe('DayView compact queue refresh layout', () => {
  it('keeps calendar navigation in place while the previous queue stays visible', async () => {
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

    const initialPositions = readNavigationPositions()
    await page.getByRole('button', { name: 'Next' }).click()

    await waitFor(() => {
      expect(readCompactQueueRefreshLayout(initialPositions)).toEqual({
        isBusy: 'true',
        visibleTask: 'Queued task 1',
        navigationPositions: initialPositions,
        initialPositions,
      })
    })
  })
})

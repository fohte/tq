import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DayViewPresentation } from '#components/day-view/day-view'
import { AppLayout } from '#components/layout/app-layout'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import { getQueueCandidates } from '#lib/queue-candidates'
import { assertDefined } from '#lib/test-utils'
import { createStoryRouter } from '#storybook-config/story-router'

// AppLayout always mounts Sidebar/StatusLine/BottomTabBar/SearchModal/
// CreateTaskModal, each of which fetches on mount; stub every such call so
// none of these tests hits the network. CreateTaskModal's queue prefetch is
// `enabled`-gated off at mount (plan starts as ''), and SearchModal's search
// queries are gated on non-empty input, so neither needs its own stub.
vi.mock('#lib/api', () => ({
  api: {
    api: {
      tasks: {
        $get: vi
          .fn()
          .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
      },
      projects: {
        $get: vi
          .fn()
          .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
      },
      labels: {
        $get: vi
          .fn()
          .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
      },
      queues: {
        $get: vi
          .fn()
          .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
        ':key': {
          items: {
            $get: vi
              .fn()
              .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
          },
        },
      },
      'saved-views': {
        $get: vi
          .fn()
          .mockResolvedValue({ ok: true, json: () => Promise.resolve([]) }),
      },
    },
  },
}))

const today = new Date()

// Enough candidates to make the queue pane taller than one viewport.
const manyCandidateTasks: Task[] = Array.from({ length: 40 }, (_, i) =>
  makeTask({
    id: `candidate-${String(i)}`,
    title: `Candidate task ${String(i)}`,
  }),
)
const manyQueueCandidates = getQueueCandidates(
  manyCandidateTasks,
  new Set(),
  today,
)

function newQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })
}

// The router's first route match resolves asynchronously even with no
// loaders, so router.load() is awaited before render() to avoid an initial
// blank paint (see https://tanstack.com/router/latest/docs/framework/react/guide/testing).
async function renderWithRouter(
  queryClient: QueryClient,
  component: () => ReactNode,
  routerOptions: { paths?: string[]; initialPath?: string } = {},
) {
  const router = createStoryRouter({ component, ...routerOptions })
  await router.load()

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

// Composes the real DayViewPresentation (unlike day-view.stories.tsx, which
// fixes the shell height via a decorator) so AppLayout's own height capping
// is what's under test, with enough queue candidates to make the pane
// taller than one viewport.
function renderDayViewWithManyCandidates(queryClient: QueryClient) {
  return renderWithRouter(
    queryClient,
    () => (
      <AppLayout>
        <DayViewPresentation
          isLoading={false}
          calendarEvents={[]}
          schedules={[]}
          onCreateTimeBlock={vi.fn()}
          queueSections={[]}
          dayQueueTasks={[]}
          queueCandidates={manyQueueCandidates}
          onReorderQueue={vi.fn()}
          onMoveTask={vi.fn()}
          onInsertCandidate={vi.fn()}
          onAddCandidate={vi.fn()}
          onRemoveFromQueue={vi.fn()}
          onAutoAssign={vi.fn()}
          isAutoAssigning={false}
          selectedDate={today}
          onDateChange={vi.fn()}
          viewMode="queue"
          onViewModeChange={vi.fn()}
        />
      </AppLayout>
    ),
    { paths: ['/tasks', '/tasks/$taskId'], initialPath: '/' },
  )
}

async function expectDocumentFitsViewport() {
  await waitFor(() => {
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      window.innerHeight + 1,
    )
  })
}

describe('AppLayout', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = newQueryClient()
  })

  // Regression check: the visual-viewport insets cap this shell's own height
  // for keyboard avoidance (see app-layout.tsx), but content taller than one
  // viewport must still push the *document* scrollable, not just this shell.
  it('lets a tall page scroll the document', async () => {
    await renderWithRouter(
      queryClient,
      () => (
        <AppLayout>
          <div style={{ height: 3000 }} />
        </AppLayout>
      ),
      { initialPath: '/tasks' },
    )

    expect(document.documentElement.scrollHeight).toBeGreaterThan(
      window.innerHeight,
    )
  })

  // Regression check: the sidebar must stay pinned to the top of the
  // viewport while the document scrolls, not just off-window (that's the
  // test above).
  it('keeps the sidebar pinned while the document scrolls', async () => {
    const { container } = await renderWithRouter(
      queryClient,
      () => (
        <AppLayout>
          <div style={{ height: 3000 }} />
        </AppLayout>
      ),
      { initialPath: '/tasks' },
    )
    const sidebar = assertDefined(
      container.querySelector('aside'),
      'the sidebar should render at desktop viewport widths',
    )

    window.scrollTo(0, window.innerHeight * 2)
    expect(sidebar.getBoundingClientRect().top).toBe(0)
  })

  it('fills the viewport on the task page route', async () => {
    const { container } = await renderWithRouter(
      queryClient,
      () => (
        <AppLayout>
          <div data-testid="fill-child" className="h-full" />
        </AppLayout>
      ),
      {
        paths: ['/tasks/$taskId/pages/$pageId'],
        initialPath: '/tasks/1/pages/2',
      },
    )

    // main, not the window, is the h-full contract: StatusLine and
    // BottomTabBar also share the shell, so main is shorter than the
    // viewport even when everything is wired correctly.
    const main = assertDefined(
      container.querySelector('main'),
      'AppLayout renders a <main> wrapping children',
    )
    const child = assertDefined(
      container.querySelector('[data-testid="fill-child"]'),
      'the story renders an h-full child inside AppLayout',
    )
    const heightDiff = Math.abs(
      child.getBoundingClientRect().height -
        main.getBoundingClientRect().height,
    )
    expect(heightDiff).toBeLessThanOrEqual(1)
  })

  // Regression check: day view's calendar and queue pane must scroll
  // internally instead of the document (see app-layout.tsx).
  it('keeps day view within one viewport with many queue candidates', async () => {
    await renderDayViewWithManyCandidates(queryClient)
    await expectDocumentFitsViewport()
  })

  // Regression check: week's 24-hour timeGrid (48 fixed-height half-hour
  // slots) is already taller than a typical viewport on its own.
  it('keeps week view within one viewport with many queue candidates', async () => {
    const { container } = await renderDayViewWithManyCandidates(queryClient)
    await userEvent.click(
      within(container).getByRole('button', { name: 'week' }),
    )
    await expectDocumentFitsViewport()
  })

  // Regression check: month view only overflows once the queue pane has
  // enough candidates to push the shared shell past one viewport.
  it('keeps month view within one viewport with many queue candidates', async () => {
    const { container } = await renderDayViewWithManyCandidates(queryClient)
    await userEvent.click(
      within(container).getByRole('button', { name: 'month' }),
    )
    await expectDocumentFitsViewport()
  })
})

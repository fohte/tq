import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fn } from 'storybook/test'

import { DayViewPresentation } from '#components/day-view/day-view'
import { AppLayout } from '#components/layout/app-layout'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { Task } from '#hooks/use-tasks'
import { getQueueCandidates } from '#lib/queue-candidates'
import { assertDefined } from '#lib/test-utils'
import { StoryRouter } from '#storybook-config/story-router'

const today = new Date()

// Enough candidates to make the queue pane taller than one viewport, the
// scenario that originally exposed AppLayout's unbounded root height.
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

function AppLayoutStory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <AppLayout>
        <div className="flex items-center justify-center p-8 text-muted-foreground">
          Page Content
        </div>
      </AppLayout>
    </QueryClientProvider>
  )
}

function AppLayoutWithRouter({ currentPath }: { currentPath: string }) {
  return <StoryRouter component={AppLayoutStory} initialPath={currentPath} />
}

const meta = {
  title: 'Layout/AppLayout',
  component: AppLayoutWithRouter,
  parameters: {
    layout: 'fullscreen',
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/queues/:key/items', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof AppLayoutWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksPage: Story = {
  args: {
    currentPath: '/tasks',
  },
}

// Regression check: the visual-viewport insets cap this shell's own height
// for keyboard avoidance (see app-layout.tsx), but content taller than one
// viewport must still push the *document* scrollable, not just this shell.
export const TallPageStillScrollsDocument: Story = {
  args: {
    currentPath: '/tasks',
  },
  parameters: {
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/queues/:key/items', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  render: () => (
    <StoryRouter
      component={() => (
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
              },
            })
          }
        >
          <AppLayout>
            <div style={{ height: 3000 }} />
          </AppLayout>
        </QueryClientProvider>
      )}
      initialPath="/tasks"
    />
  ),
  play: async ({ canvasElement }) => {
    const view = assertDefined(
      canvasElement.ownerDocument.defaultView,
      'a mounted story always has an owner window',
    )

    await expect(view.document.documentElement.scrollHeight).toBeGreaterThan(
      view.innerHeight,
    )
  },
}

// Regression check: the sidebar must stay pinned to the top of the
// viewport while the document scrolls, not just off-window (that's the
// story above).
export const SidebarStaysPinnedWhileScrollingDocument: Story = {
  args: {
    currentPath: '/tasks',
  },
  parameters: {
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/queues/:key/items', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  render: () => (
    <StoryRouter
      component={() => (
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
              },
            })
          }
        >
          <AppLayout>
            <div style={{ height: 3000 }} />
          </AppLayout>
        </QueryClientProvider>
      )}
      initialPath="/tasks"
    />
  ),
  play: async ({ canvasElement }) => {
    const view = assertDefined(
      canvasElement.ownerDocument.defaultView,
      'a mounted story always has an owner window',
    )
    const sidebar = assertDefined(
      canvasElement.querySelector('aside'),
      'the sidebar should render at desktop viewport widths',
    )

    view.scrollTo(0, view.innerHeight * 2)
    await expect(sidebar.getBoundingClientRect().top).toBe(0)
  },
}

// Regression check: day view (route "/") is the one route that must NOT let
// the document grow past one viewport — its calendar and queue pane are
// meant to scroll internally instead (see app-layout.tsx). This composes the
// real DayViewPresentation, which day-view.stories.tsx's own stories don't
// exercise this way (they fix the shell height via a decorator), so it's the
// only place that catches AppLayout failing to cap the shell to one
// viewport. day/week's 24-hour timeGrid (48 half-hour slots at a fixed
// height) is already taller than a typical viewport on its own; month view
// only overflows once the queue pane has enough candidates to push it,
// which is why this story stocks the queue heavily.
export const DayViewStaysWithinViewportAcrossCalendarViews: Story = {
  tags: ['desktop-only'],
  args: {
    currentPath: '/',
  },
  parameters: {
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.get('/api/tasks', () => HttpResponse.json([])),
        http.get('/api/projects', () => HttpResponse.json([])),
        http.get('/api/queues/:key/items', () => HttpResponse.json([])),
        http.get('/api/saved-views', () => HttpResponse.json([])),
        http.get('/api/labels', () => HttpResponse.json([])),
      ],
    },
  },
  render: () => (
    <StoryRouter
      component={() => (
        <QueryClientProvider
          client={
            new QueryClient({
              defaultOptions: {
                queries: { retry: false, staleTime: Infinity },
              },
            })
          }
        >
          <AppLayout>
            <DayViewPresentation
              isLoading={false}
              calendarEvents={[]}
              schedules={[]}
              onCreateTimeBlock={fn()}
              queueSections={[]}
              dayQueueTasks={[]}
              queueCandidates={manyQueueCandidates}
              onReorderQueue={fn()}
              onMoveTask={fn()}
              onInsertCandidate={fn()}
              onAddCandidate={fn()}
              onRemoveFromQueue={fn()}
              onAutoAssign={fn()}
              isAutoAssigning={false}
              selectedDate={today}
              onDateChange={fn()}
              viewMode="queue"
              onViewModeChange={fn()}
            />
          </AppLayout>
        </QueryClientProvider>
      )}
      paths={['/tasks', '/tasks/$taskId']}
      initialPath="/"
    />
  ),
  play: async ({ canvas, canvasElement, userEvent }) => {
    const view = assertDefined(
      canvasElement.ownerDocument.defaultView,
      'a mounted story always has an owner window',
    )

    const expectDocumentFitsViewport = async () => {
      await expect(
        view.document.documentElement.scrollHeight,
      ).toBeLessThanOrEqual(view.innerHeight + 1)
    }

    await expectDocumentFitsViewport()

    await userEvent.click(canvas.getByRole('button', { name: 'week' }))
    await expectDocumentFitsViewport()

    await userEvent.click(canvas.getByRole('button', { name: 'month' }))
    await expectDocumentFitsViewport()
  },
}

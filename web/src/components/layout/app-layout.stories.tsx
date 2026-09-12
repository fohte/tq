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

export const TaskPageRouteFillsViewport: Story = {
  args: {
    currentPath: '/tasks/1/pages/2',
  },
  parameters: {
    screenshot: { skip: true },
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
            <div data-testid="fill-child" className="h-full" />
          </AppLayout>
        </QueryClientProvider>
      )}
      paths={['/tasks/$taskId/pages/$pageId']}
      initialPath="/tasks/1/pages/2"
    />
  ),
  play: async ({ canvasElement }) => {
    // main, not the window, is the h-full contract: StatusLine and
    // BottomTabBar also share the shell, so main is shorter than the
    // viewport even when everything is wired correctly.
    const main = assertDefined(
      canvasElement.querySelector('main'),
      'AppLayout renders a <main> wrapping children',
    )
    const child = assertDefined(
      canvasElement.querySelector('[data-testid="fill-child"]'),
      'the story renders an h-full child inside AppLayout',
    )
    const heightDiff = Math.abs(
      child.getBoundingClientRect().height -
        main.getBoundingClientRect().height,
    )
    await expect(heightDiff).toBeLessThanOrEqual(1)
  },
}

// Composes the real DayViewPresentation (unlike day-view.stories.tsx, which
// fixes the shell height via a decorator) so AppLayout's own height capping
// is what's under test, with enough queue candidates to make the pane
// taller than one viewport.
function renderDayViewWithManyCandidates() {
  return (
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
  )
}

async function expectDocumentFitsViewport(canvasElement: HTMLElement) {
  const view = assertDefined(
    canvasElement.ownerDocument.defaultView,
    'a mounted story always has an owner window',
  )
  await expect(view.document.documentElement.scrollHeight).toBeLessThanOrEqual(
    view.innerHeight + 1,
  )
}

// Regression check: day view's calendar and queue pane must scroll
// internally instead of the document (see app-layout.tsx).
export const DayViewStaysWithinViewport: Story = {
  tags: ['desktop-only'],
  args: {
    currentPath: '/',
  },
  parameters: {
    screenshot: { skip: true },
  },
  render: renderDayViewWithManyCandidates,
  play: async ({ canvasElement }) => {
    await expectDocumentFitsViewport(canvasElement)
  },
}

// Regression check: week's 24-hour timeGrid (48 fixed-height half-hour
// slots) is already taller than a typical viewport on its own.
export const WeekViewStaysWithinViewport: Story = {
  tags: ['desktop-only'],
  args: {
    currentPath: '/',
  },
  parameters: {
    screenshot: { skip: true },
  },
  render: renderDayViewWithManyCandidates,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'week' }))
    await expectDocumentFitsViewport(canvasElement)
  },
}

// Regression check: month view only overflows once the queue pane has
// enough candidates to push the shared shell past one viewport.
export const MonthViewStaysWithinViewport: Story = {
  tags: ['desktop-only'],
  args: {
    currentPath: '/',
  },
  parameters: {
    screenshot: { skip: true },
  },
  render: renderDayViewWithManyCandidates,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'month' }))
    await expectDocumentFitsViewport(canvasElement)
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { CalendarDndCallbacks } from '@web/components/calendar/calendar-grid'
import {
  CalendarView,
  type TimeBlockEvent,
} from '@web/components/calendar/calendar-view'
import { TaskRow } from '@web/components/task/task-row'
import type { Task } from '@web/hooks/use-tasks'
import type { ReactNode } from 'react'
import { useRef } from 'react'
import { fn } from 'storybook/test'

const today = new Date()
const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

const sampleEvents: TimeBlockEvent[] = [
  {
    id: '1',
    title: 'API ドキュメント作成',
    start: `${dateStr}T09:00:00`,
    end: `${dateStr}T10:00:00`,
    type: 'manual',
    duration: '1h',
    label: 'dev:tq',
  },
  {
    id: '2',
    title: 'テスト追加',
    start: `${dateStr}T10:30:00`,
    end: `${dateStr}T11:30:00`,
    type: 'auto',
    duration: '1h',
    parentRef: '#488 tq 作成',
  },
  {
    id: '3',
    title: 'Team standup',
    start: `${dateStr}T11:00:00`,
    end: `${dateStr}T11:30:00`,
    type: 'gcal',
  },
  {
    id: '4',
    title: 'CI パイプライン構築',
    start: `${dateStr}T14:00:00`,
    end: `${dateStr}T15:00:00`,
    type: 'completed',
    duration: '1h',
  },
  {
    id: '5',
    title: 'Gym',
    start: `${dateStr}T07:00:00`,
    end: `${dateStr}T08:00:00`,
    type: 'schedule',
    color: { bg: '#1B4332', accent: '#52B788' },
    icon: 'dumbbell',
  },
  {
    id: '6',
    title: 'Lunch',
    start: `${dateStr}T12:00:00`,
    end: `${dateStr}T13:00:00`,
    type: 'gcal',
  },
  {
    id: '9',
    title: 'Quick sync',
    start: `${dateStr}T15:00:00`,
    end: `${dateStr}T15:15:00`,
    type: 'gcal',
  },
  {
    id: '10',
    title: 'PR レビュー',
    start: `${dateStr}T16:00:00`,
    end: `${dateStr}T16:30:00`,
    type: 'manual',
    duration: '30m',
  },
]

const meta = {
  title: 'Calendar/CalendarView',
  component: CalendarView,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ height: '100vh' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CalendarView>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {},
}

export const WithEvents: Story = {
  args: {
    events: sampleEvents,
  },
}

export const ManualOnly: Story = {
  args: {
    events: sampleEvents.filter((e) => e.type === 'manual'),
  },
}

const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)
const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Deploy to staging',
  description: null,
  status: 'todo',
  context: 'work',
  startDate: dateStr,
  dueDate: null,
  estimatedMinutes: 30,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const sampleTasks: Task[] = [
  { ...baseTask },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000002',
    title: 'Write unit tests',
    estimatedMinutes: 60,
    context: 'dev',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000003',
    title: 'Fix CI pipeline',
    estimatedMinutes: null,
    context: 'personal',
  },
  {
    ...baseTask,
    id: '00000000-0000-0000-0000-000000000004',
    title: 'Review PR',
    estimatedMinutes: 45,
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, taskRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

const dndCallbacks: CalendarDndCallbacks = {
  onEventDrop: fn(),
  onEventResize: fn(),
  onExternalDrop: fn(),
}

export const WithDragAndDrop: Story = {
  args: {
    events: sampleEvents,
    dndCallbacks,
  },
  render: (args) => {
    const taskListRef = useRef<HTMLDivElement>(null)

    return (
      <Providers>
        <div className="flex h-full">
          <div
            ref={taskListRef}
            className="flex w-80 flex-col border-r border-border"
          >
            <div className="border-b border-border px-3 py-2 text-sm font-medium">
              Today
            </div>
            <div className="flex-1 overflow-auto py-1">
              {sampleTasks.map((task) => (
                <TaskRow key={task.id} task={task} draggable />
              ))}
            </div>
          </div>
          <div className="flex-1">
            <CalendarView {...args} externalDragContainerRef={taskListRef} />
          </div>
        </div>
      </Providers>
    )
  },
}

export const OvernightEvents: Story = {
  args: {
    events: [
      ...sampleEvents,
      {
        id: '7',
        title: 'Overnight deploy',
        start: `${dateStr}T23:00:00`,
        end: `${tomorrowStr}T01:00:00`,
        type: 'manual',
        duration: '2h',
      },
      {
        id: '8',
        title: 'Sleep',
        start: `${dateStr}T23:30:00`,
        end: `${tomorrowStr}T07:00:00`,
        type: 'schedule',
        color: { bg: '#2D2B55', accent: '#6C63FF' },
        icon: 'moon',
      },
    ],
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'

import { StatusLine } from '#components/layout/status-line'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'
import type { TodayTask } from '#hooks/use-today-tasks'
import { formatLocalDate } from '#lib/date-range'

const todayStr = formatLocalDate(new Date())

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: 30,
  parentId: null,
  parentNumber: null,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

const tasks: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', estimatedMinutes: 30 },
  { ...baseTask, id: '2', title: 'Task B', estimatedMinutes: 60 },
  {
    ...baseTask,
    id: '3',
    title: 'Task C',
    status: 'completed',
    estimatedMinutes: 45,
  },
]

const queueTasks: TodayTask[] = tasks.map((task, index) => ({
  id: `queue-${task.id}`,
  taskId: task.id,
  date: todayStr,
  sortOrder: index,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}))

function StatusLineStory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)
  queryClient.setQueryData(['today-tasks', 'list', todayStr], queueTasks)

  return (
    <QueryClientProvider client={queryClient}>
      <StatusLine />
    </QueryClientProvider>
  )
}

function StatusLineWithRouter({ currentPath }: { currentPath: string }) {
  const rootRoute = createRootRoute({ component: StatusLineStory })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [currentPath] }),
  })

  return <RouterProvider router={router} />
}

const meta = {
  title: 'Layout/StatusLine',
  component: StatusLineWithRouter,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    currentPath: {
      control: 'select',
      options: ['/', '/tasks', '/today', '/projects'],
    },
  },
} satisfies Meta<typeof StatusLineWithRouter>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    currentPath: '/',
  },
}

export const TasksPath: Story = {
  args: {
    currentPath: '/tasks',
  },
}

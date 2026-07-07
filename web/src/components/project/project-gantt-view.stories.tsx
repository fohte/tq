import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { ProjectGanttView } from '@web/components/project/project-gantt-view'
import type { ProjectTask } from '@web/hooks/use-projects'
import type { ReactNode } from 'react'

function formatDateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const baseTask: ProjectTask = {
  id: '1',
  title: 'Task',
  description: null,
  status: 'todo',
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: 'p1',
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const sampleTasks: ProjectTask[] = [
  {
    ...baseTask,
    id: '1',
    title: 'Design',
    status: 'completed',
    startDate: formatDateOffset(-7),
    dueDate: formatDateOffset(-3),
  },
  {
    ...baseTask,
    id: '2',
    title: 'Implementation',
    status: 'in_progress',
    startDate: formatDateOffset(-2),
    dueDate: formatDateOffset(3),
  },
  {
    ...baseTask,
    id: '2-1',
    title: 'API',
    parentId: '2',
    status: 'in_progress',
    startDate: formatDateOffset(-2),
    dueDate: formatDateOffset(0),
  },
  {
    ...baseTask,
    id: '2-2',
    title: 'UI',
    parentId: '2',
    status: 'todo',
    startDate: formatDateOffset(0),
    dueDate: formatDateOffset(3),
  },
  {
    ...baseTask,
    id: '3',
    title: 'Launch',
    status: 'todo',
    startDate: formatDateOffset(5),
    dueDate: formatDateOffset(6),
  },
  {
    ...baseTask,
    id: '4',
    title: 'Backlog idea',
    status: 'todo',
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

function ProjectGanttViewWithProviders({ tasks }: { tasks: ProjectTask[] }) {
  return (
    <Providers>
      <div style={{ height: '600px' }}>
        <ProjectGanttView tasks={tasks} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Project/ProjectGanttView',
  component: ProjectGanttViewWithProviders,
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof ProjectGanttViewWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    tasks: sampleTasks,
  },
}

export const Empty: Story = {
  args: {
    tasks: [],
  },
}

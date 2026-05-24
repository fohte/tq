import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { ProjectTaskList } from '@web/components/project/project-task-list'
import type { ProjectTask } from '@web/hooks/use-projects'
import type { ReactNode } from 'react'

const baseTask: ProjectTask = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: '00000000-0000-0000-0000-000000000099',
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

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

const sampleTasks: ProjectTask[] = [
  { ...baseTask, id: '1', title: 'Design system setup', status: 'completed' },
  {
    ...baseTask,
    id: '2',
    title: 'Implement sidebar navigation',
    status: 'completed',
    estimatedMinutes: 60,
  },
  {
    ...baseTask,
    id: '3',
    title: 'Build project board header',
    status: 'in_progress',
    context: 'work',
    estimatedMinutes: 120,
  },
  {
    ...baseTask,
    id: '4',
    title: 'Add filter bar component',
    status: 'todo',
    estimatedMinutes: 45,
    dueDate: '2026-04-10',
  },
  {
    ...baseTask,
    id: '5',
    title: 'Write unit tests',
    status: 'todo',
    context: 'dev',
    estimatedMinutes: 90,
  },
  {
    ...baseTask,
    id: '6',
    title: 'Sub-task of filter bar',
    status: 'todo',
    parentId: '4',
    estimatedMinutes: 30,
  },
  {
    ...baseTask,
    id: '7',
    title: 'Another sub-task',
    status: 'completed',
    parentId: '4',
  },
]

function WrappedProjectTaskList(
  props: React.ComponentProps<typeof ProjectTaskList>,
) {
  return (
    <Providers>
      <div className="w-[500px]">
        <ProjectTaskList {...props} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Project/ProjectTaskList',
  component: WrappedProjectTaskList,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof WrappedProjectTaskList>

export default meta
type Story = StoryObj<typeof meta>

export const AllTasks: Story = {
  args: {
    tasks: sampleTasks,
    statusFilter: 'all',
    sortOption: 'manual',
  },
}

export const TodoOnly: Story = {
  args: {
    tasks: sampleTasks,
    statusFilter: 'todo',
    sortOption: 'manual',
  },
}

export const CompletedOnly: Story = {
  args: {
    tasks: sampleTasks,
    statusFilter: 'completed',
    sortOption: 'manual',
  },
}

export const SortedByDue: Story = {
  args: {
    tasks: sampleTasks,
    statusFilter: 'all',
    sortOption: 'due',
  },
}

export const Empty: Story = {
  args: {
    tasks: [],
    statusFilter: 'all',
    sortOption: 'manual',
  },
}

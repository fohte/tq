import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TaskRow } from '@web/components/task/task-row'
import type { Task } from '@web/hooks/use-tasks'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: null,
  sortOrder: 0,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

function TaskRowWithProviders({ task }: { task: Task }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    component: () => (
      <div className="w-96">
        <TaskRow task={task} />
      </div>
    ),
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

const meta = {
  title: 'Task/TaskRow',
  component: TaskRowWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskRowWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    task: { ...baseTask },
  },
}

export const InProgress: Story = {
  args: {
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
  },
}

export const Completed: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const WithEstimate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Write API documentation',
      estimatedMinutes: 120,
    },
  },
}

export const WorkContext: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Deploy to production',
      context: 'work',
      estimatedMinutes: 30,
    },
  },
}

export const DevContext: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Fix armyknife build',
      context: 'dev',
      estimatedMinutes: 90,
    },
  },
}

export const WithParent: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Add unit tests',
      parentId: 'abcd0000-0000-0000-0000-000000000000',
    },
  },
}

export const AllFeatures: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Implement authentication flow',
      status: 'in_progress',
      context: 'work',
      estimatedMinutes: 180,
      parentId: 'abcd0000-0000-0000-0000-000000000000',
    },
  },
}

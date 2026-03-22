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
import type { ReactNode } from 'react'

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
  activeTimeBlockStartTime: null,
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

function TaskRowWithProviders({ task }: { task: Task }) {
  return (
    <Providers>
      <div className="w-96">
        <TaskRow task={task} />
      </div>
    </Providers>
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
    task: {
      ...baseTask,
      status: 'in_progress',
      title: 'Review pull request',
      updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      activeTimeBlockStartTime: new Date(
        Date.now() - 5 * 60 * 1000,
      ).toISOString(),
    },
  },
}

export const InProgressWithEstimate: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'in_progress',
      title: 'Reviewing code changes',
      estimatedMinutes: 30,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      activeTimeBlockStartTime: new Date(
        Date.now() - 10 * 60 * 1000,
      ).toISOString(),
    },
  },
}

export const InProgressOverEstimate: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'in_progress',
      title: 'Task running over estimate',
      estimatedMinutes: 15,
      updatedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      activeTimeBlockStartTime: new Date(
        Date.now() - 20 * 60 * 1000,
      ).toISOString(),
    },
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

export const AllVariants: Story = {
  args: { task: baseTask },
  render: () => {
    const tasks: Task[] = [
      { ...baseTask, id: '1', title: 'Todo task (personal)' },
      {
        ...baseTask,
        id: '2',
        title: 'In progress task',
        status: 'in_progress',
        estimatedMinutes: 60,
        updatedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        activeTimeBlockStartTime: new Date(
          Date.now() - 25 * 60 * 1000,
        ).toISOString(),
      },
      {
        ...baseTask,
        id: '3',
        title: 'Completed task',
        status: 'completed',
        estimatedMinutes: 30,
      },
      {
        ...baseTask,
        id: '4',
        title: 'Work context with estimate',
        context: 'work',
        estimatedMinutes: 120,
      },
      {
        ...baseTask,
        id: '5',
        title: 'Dev context with estimate',
        context: 'dev',
        estimatedMinutes: 90,
      },
      {
        ...baseTask,
        id: '6',
        title: 'Task with parent reference',
        parentId: 'abcd0000-0000-0000-0000-000000000000',
        estimatedMinutes: 45,
      },
      {
        ...baseTask,
        id: '7',
        title: 'All features combined',
        status: 'in_progress',
        context: 'work',
        estimatedMinutes: 180,
        parentId: 'abcd0000-0000-0000-0000-000000000000',
        updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        activeTimeBlockStartTime: new Date(
          Date.now() - 45 * 60 * 1000,
        ).toISOString(),
      },
    ]

    return (
      <Providers>
        <div className="w-96 divide-y divide-border">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </div>
      </Providers>
    )
  },
}

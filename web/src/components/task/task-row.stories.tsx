import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

import { TagFilterBar } from '#components/tag-filter-bar'
import { TaskRow } from '#components/task/task-row'
import type { Task } from '#hooks/use-tasks'

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
  estimatedMinutes: null,
  parentId: null,
  parentNumber: null,
  projectId: null,
  recurrenceRuleId: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
}

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({
    validateSearch: (search: Record<string, unknown>) => search,
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

export const WithParent: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Add unit tests',
      parentId: 'abcd0000-0000-0000-0000-000000000000',
    },
  },
}

export const WithDueDate: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Submit expense report',
      // Far future so this story never flips to overdue.
      dueDate: '2099-06-15',
    },
  },
}

export const Overdue: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Renew SSL certificate',
      // Fixed past date so this story always renders as overdue.
      dueDate: '2020-01-01',
    },
  },
}

export const OverdueCompleted: Story = {
  args: {
    task: {
      ...baseTask,
      status: 'completed',
      title: 'Renew SSL certificate',
      dueDate: '2020-01-01',
    },
  },
}

export const WithGithubLink: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Fix flaky test',
      githubLink: {
        id: 'link-1',
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
        url: 'https://github.com/fohte/tq/issues/42',
        state: 'open',
        title: 'Fix flaky test',
        lastSyncedAt: '2026-03-20T00:00:00.000Z',
      },
    },
  },
}

export const WithTags: Story = {
  args: {
    task: {
      ...baseTask,
      title: 'Ship the release notes',
      labels: ['dev:tq', 'chore'],
    },
  },
}

export const TagClick: Story = {
  args: {
    task: { ...baseTask, title: 'Click a tag token', labels: ['dev:tq'] },
  },
  render: (args) => (
    <Providers>
      <div className="w-96">
        <TaskRow task={args.task} />
        <TagFilterBar />
      </div>
    </Providers>
  ),
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByText('#dev:tq'))
    await expect(canvas.getByText('filtered by')).toBeVisible()
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

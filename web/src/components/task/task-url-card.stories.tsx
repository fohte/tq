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

import { TaskUrlCard } from '#components/task/task-url-card'
import type { TaskUrlPreview } from '#hooks/use-task-url-preview'
import { taskUrlPreviewKeys } from '#hooks/use-task-url-preview'

const TASK_URL = 'https://tq.fohte.net/tasks/42'
const UNRESOLVED_URL = 'https://tq.fohte.net/tasks/999'

const baseTask: TaskUrlPreview = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task URL live preview',
  description:
    'Adds live preview cards for pasted tq task URLs when they are the entire content of a paragraph.',
  status: 'todo',
  context: 'personal',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: null,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

function Providers({
  url,
  task,
  children,
}: {
  url: string
  task: TaskUrlPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskUrlPreviewKeys.preview(url), task)

  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const taskRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks/$taskId',
    component: () => null,
  })
  rootRoute.addChildren([taskRoute])
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

function TaskUrlCardWithProviders({
  url,
  raw,
  task,
}: {
  url: string
  raw: string
  task: TaskUrlPreview | null
}) {
  return (
    <Providers url={url} task={task}>
      <div className="w-96">
        <TaskUrlCard data={{ url }} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskUrlCard',
  component: TaskUrlCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskUrlCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: { url: TASK_URL, raw: TASK_URL, task: baseTask },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(baseTask.title)).toBeVisible()
    await expect(canvas.getByText(baseTask.description ?? '')).toBeVisible()
  },
}

export const InProgress: Story = {
  args: {
    url: TASK_URL,
    raw: TASK_URL,
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
  },
}

export const Completed: Story = {
  args: {
    url: TASK_URL,
    raw: TASK_URL,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

// The task preview hasn't resolved yet (or the URL doesn't point at an
// actual task): the card falls back to rendering the raw matched text while
// its data is unresolved.
export const Unresolved: Story = {
  args: { url: UNRESOLVED_URL, raw: UNRESOLVED_URL, task: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}

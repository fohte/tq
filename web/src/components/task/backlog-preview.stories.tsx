import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { BacklogPreview } from '#components/task/backlog-preview'
import type { Task } from '#hooks/use-tasks'

const makeBacklogTasks = (count: number): Task[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `00000000-0000-0000-0000-00000000000${String(i)}`,
    number: i + 1,
    title: `Backlog task ${String(i + 1)}`,
    description: null,
    status: 'todo' as const,
    context: 'personal' as const,
    labels: [],
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    parentId: null,
    parentNumber: null,
    projectId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    childCompletionCount: { completed: 0, total: 0 },
  }))

function Providers({ children }: { children: ReactNode }) {
  const rootRoute = createRootRoute({
    component: () => <>{children}</>,
  })
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })
  const tasksRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/tasks',
    component: () => null,
  })
  rootRoute.addChildren([indexRoute, tasksRoute])

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  return <RouterProvider router={router} />
}

const meta = {
  title: 'Task/BacklogPreview',
  component: BacklogPreview,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Providers>
          <Story />
        </Providers>
      </div>
    ),
  ],
} satisfies Meta<typeof BacklogPreview>

export default meta
type Story = StoryObj<typeof meta>

export const FewTasks: Story = {
  args: {
    tasks: makeBacklogTasks(2),
  },
}

export const WithViewAll: Story = {
  args: {
    tasks: makeBacklogTasks(5),
  },
}

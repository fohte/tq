import { DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { createContext, type ReactNode, useContext, useState } from 'react'
import { fn } from 'storybook/test'

import { QueueCandidateRow } from '#components/task/queue-candidate-row'
import type { Task } from '#hooks/use-tasks'

const ChildrenContext = createContext<ReactNode>(null)

function RootRouteContent() {
  return <>{useContext(ChildrenContext)}</>
}

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  const [router] = useState(() => {
    const rootRoute = createRootRoute({
      component: RootRouteContent,
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
    return createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
  })

  return (
    <QueryClientProvider client={queryClient}>
      <ChildrenContext.Provider value={children}>
        <RouterProvider router={router} />
      </ChildrenContext.Provider>
    </QueryClientProvider>
  )
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    number: 1,
    title: 'Renew SSL certificate',
    description: null,
    status: 'todo',
    context: 'personal',
    startDate: null,
    dueDate: null,
    estimatedMinutes: null,
    labels: [],
    parentId: null,
    parentNumber: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    githubLink: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

const meta = {
  title: 'Task/QueueCandidateRow',
  component: QueueCandidateRow,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-96">
          <DndContext>
            <Story />
          </DndContext>
        </div>
      </Providers>
    ),
  ],
  args: {
    onAdd: fn(),
  },
} satisfies Meta<typeof QueueCandidateRow>

export default meta
type Story = StoryObj<typeof meta>

export const Overdue: Story = {
  args: {
    task: makeTask({ dueDate: '2026-03-17' }),
    reason: { kind: 'overdue', days: 3 },
  },
}

export const DueToday: Story = {
  args: {
    task: makeTask({ title: 'Submit expense report', dueDate: '2026-03-20' }),
    reason: { kind: 'due-today' },
  },
}

export const StartsToday: Story = {
  args: {
    task: makeTask({ title: 'Plan the launch', startDate: '2026-03-20' }),
    reason: { kind: 'starts', days: 0 },
  },
}

export const StartedDaysAgo: Story = {
  args: {
    task: makeTask({
      title: 'Write API documentation',
      startDate: '2026-03-17',
    }),
    reason: { kind: 'starts', days: 3 },
  },
}

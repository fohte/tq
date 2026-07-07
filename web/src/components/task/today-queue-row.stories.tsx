import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { TodayQueueRow } from '@web/components/task/today-queue-row'
import type { Task } from '@web/hooks/use-tasks'
import { type ReactNode, useRef, useState } from 'react'
import { fn } from 'storybook/test'

function Providers({ children }: { children: ReactNode }) {
  const childrenRef = useRef(children)
  childrenRef.current = children

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  const [router] = useState(() => {
    const rootRoute = createRootRoute({
      component: () => <>{childrenRef.current}</>,
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
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Write the quarterly report',
    description: null,
    status: 'todo',
    context: 'work',
    startDate: null,
    dueDate: null,
    estimatedMinutes: 30,
    parentId: null,
    projectId: null,
    sortOrder: 0,
    recurrenceRuleId: null,
    recurrenceRule: null,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    activeTimeBlockStartTime: null,
    ...overrides,
  }
}

const meta = {
  title: 'Task/TodayQueueRow',
  component: TodayQueueRow,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-96">
          <DndContext collisionDetection={closestCenter}>
            <SortableContext
              items={['00000000-0000-0000-0000-000000000001']}
              strategy={verticalListSortingStrategy}
            >
              <Story />
            </SortableContext>
          </DndContext>
        </div>
      </Providers>
    ),
  ],
  args: {
    onRemove: fn(),
  },
} satisfies Meta<typeof TodayQueueRow>

export default meta
type Story = StoryObj<typeof meta>

export const WithEstimate: Story = {
  args: {
    task: makeTask(),
  },
}

export const MissingEstimate: Story = {
  args: {
    task: makeTask({ estimatedMinutes: null, title: 'Plan the launch' }),
  },
}

export const InProgress: Story = {
  args: {
    task: makeTask({ status: 'in_progress' }),
  },
}

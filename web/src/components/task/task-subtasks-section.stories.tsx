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

import { TaskSubtasksList } from '#components/task/task-subtasks-section'
import type { Task } from '#hooks/use-tasks'

const parentTaskId = '00000000-0000-0000-0000-000000000001'

const baseSubtask: Task = {
  id: '00000000-0000-0000-0000-000000000011',
  number: 11,
  title: 'Sketch wireframes',
  description: null,
  status: 'todo',
  context: 'work',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: 30,
  parentId: parentTaskId,
  parentNumber: 1,
  projectId: null,
  sortOrder: 0,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLink: null,
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
}

const mixedSubtasks: Task[] = [
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000011',
    number: 11,
    title: 'Sketch wireframes',
    status: 'completed',
    estimatedMinutes: 30,
  },
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000012',
    number: 12,
    title: 'Get feedback from the team',
    status: 'in_progress',
    estimatedMinutes: 15,
  },
  {
    ...baseSubtask,
    id: '00000000-0000-0000-0000-000000000013',
    number: 13,
    title: 'Finalize the design',
    status: 'todo',
    estimatedMinutes: null,
  },
]

const allCompletedSubtasks: Task[] = mixedSubtasks.map((subtask) => ({
  ...subtask,
  status: 'completed',
}))

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

function SectionStory({ subtasks }: { subtasks: Task[] }) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskSubtasksList subtasks={subtasks} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/Subtasks/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const Default: SectionStoryType = {
  args: { subtasks: mixedSubtasks },
}

export const AllCompleted: SectionStoryType = {
  args: { subtasks: allCompletedSubtasks },
}

export const Empty: SectionStoryType = {
  args: { subtasks: [] },
}

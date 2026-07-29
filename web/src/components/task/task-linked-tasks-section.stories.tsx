import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { TaskLinkedTasksSection } from '#components/task/task-linked-tasks-section'
import type { LinkedTaskSummary } from '#hooks/use-tasks'

const outgoingTasks: LinkedTaskSummary[] = [
  {
    id: 'task-002',
    number: 12,
    title: 'Design the schema',
    status: 'completed',
  },
  {
    id: 'task-003',
    number: 15,
    title: 'Write the migration',
    status: 'in_progress',
  },
]

const incomingTasks: LinkedTaskSummary[] = [
  {
    id: 'task-004',
    number: 20,
    title: 'Ship the release notes',
    status: 'todo',
  },
]

function Providers({ children }: { children: ReactNode }) {
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

  return <RouterProvider router={router} />
}

function SectionStory({
  outgoing,
  incoming,
}: {
  outgoing: LinkedTaskSummary[]
  incoming: LinkedTaskSummary[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskLinkedTasksSection outgoing={outgoing} incoming={incoming} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/LinkedTasks/Section',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type SectionStoryType = StoryObj<typeof meta>

export const WithBothDirections: SectionStoryType = {
  args: { outgoing: outgoingTasks, incoming: incomingTasks },
}

export const OutgoingOnly: SectionStoryType = {
  args: { outgoing: outgoingTasks, incoming: [] },
}

export const IncomingOnly: SectionStoryType = {
  args: { outgoing: [], incoming: incomingTasks },
}

export const Empty: SectionStoryType = {
  args: { outgoing: [], incoming: [] },
}

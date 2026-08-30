import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskLinkedTasksSection } from '#components/task/task-linked-tasks-section'
import type { LinkedTaskSummary } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseLinkedTask: LinkedTaskSummary = {
  id: 'task-001',
  number: 12,
  title: 'Design the schema',
  description: null,
  status: 'todo',
  context: 'work',
  commitment: 'active',
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

const outgoingTasks: LinkedTaskSummary[] = [
  {
    ...baseLinkedTask,
    id: 'task-002',
    number: 12,
    title: 'Design the schema',
    status: 'completed',
  },
  {
    ...baseLinkedTask,
    id: 'task-003',
    number: 15,
    title: 'Write the migration',
    status: 'in_progress',
  },
]

const incomingTasks: LinkedTaskSummary[] = [
  {
    ...baseLinkedTask,
    id: 'task-004',
    number: 20,
    title: 'Ship the release notes',
    status: 'todo',
  },
]

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
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

import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskLinkedTasksSection } from '#components/task/task-linked-tasks-section'
import { makeTask } from '#components/task/task-row-test-fixtures'
import type { LinkedTaskSummary } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const outgoingTasks: LinkedTaskSummary[] = [
  makeTask({
    id: 'task-002',
    number: 12,
    title: 'Design the schema',
    context: 'work',
    status: 'completed',
  }),
  makeTask({
    id: 'task-003',
    number: 15,
    title: 'Write the migration',
    context: 'work',
  }),
]

const incomingTasks: LinkedTaskSummary[] = [
  makeTask({
    id: 'task-004',
    number: 20,
    title: 'Ship the release notes',
    context: 'work',
  }),
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

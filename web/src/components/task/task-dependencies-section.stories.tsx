import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskDependenciesSection } from '#components/task/task-dependencies-section'
import type { LinkedTaskSummary } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const taskId = '00000000-0000-0000-0000-000000000001'

const baseTask: LinkedTaskSummary = {
  id: 'task-001',
  number: 12,
  title: 'Design the schema',
  description: null,
  status: 'todo',
  statusReason: null,
  duplicateOfNumber: null,
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
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  childCompletionCount: { completed: 0, total: 0 },
  blockedByNumbers: [],
}

const blockedByTasks: LinkedTaskSummary[] = [
  { ...baseTask, id: 'task-002', number: 312, title: 'Decide the DB schema' },
  {
    ...baseTask,
    id: 'task-003',
    number: 315,
    title: 'Decide the auth approach',
  },
]

const blockingTasks: LinkedTaskSummary[] = [
  {
    ...baseTask,
    id: 'task-004',
    number: 324,
    title: 'Make settings editable from admin screen',
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
  blockedBy,
  blocking,
}: {
  blockedBy: LinkedTaskSummary[]
  blocking: LinkedTaskSummary[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskDependenciesSection
          taskId={taskId}
          blockedBy={blockedBy}
          blocking={blocking}
        />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskDependenciesSection',
  component: SectionStory,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SectionStory>

export default meta
type Story = StoryObj<typeof meta>

export const WithBothGroups: Story = {
  args: { blockedBy: blockedByTasks, blocking: blockingTasks },
}

export const BlockedByOnly: Story = {
  args: { blockedBy: blockedByTasks, blocking: [] },
}

export const Empty: Story = {
  args: { blockedBy: [], blocking: [] },
}

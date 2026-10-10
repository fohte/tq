import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeGithubBlocker } from '#components/task/github-link-test-fixtures'
import { TaskDependenciesSection } from '#components/task/task-dependencies-section'
import { makeTaskWithDescription } from '#components/task/task-row-test-fixtures'
import { makeTaskWait } from '#components/task/task-wait-test-fixtures'
import type { LinkedTaskSummary, TaskWait } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const taskId = '00000000-0000-0000-0000-000000000001'

const baseTask: LinkedTaskSummary = makeTaskWithDescription({
  id: 'task-001',
  number: 12,
  title: 'Design the schema',
  context: 'work',
})

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

const githubBlockers = [
  makeGithubBlocker({
    id: 'github-blocker-open',
    owner: 'example-team',
    repo: 'sample-project',
    number: 2048,
    title: 'Update the build tools',
  }),
  makeGithubBlocker({
    id: 'github-blocker-merged',
    owner: 'sample-group',
    repo: 'sample-cli',
    number: 87,
    kind: 'pull_request',
    state: 'merged',
    title: 'Add the config file option',
    url: 'https://github.com/sample-group/sample-cli/pull/87',
  }),
]

const waits: TaskWait[] = [
  makeTaskWait({
    body: 'Review the proposal\n\nPlease confirm the updated timeline.',
    label: 'Review the proposal',
  }),
  makeTaskWait({
    id: 'wait-example-002',
    body: 'Confirm the revised estimate',
    label: 'Confirm the revised estimate',
    followUpDate: '2099-10-15',
    resolvedAt: '2099-10-11T00:00:00.000Z',
    acknowledgedAt: '2099-10-11T00:00:00.000Z',
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
  blockedBy,
  blocking,
  githubBlockers: currentGithubBlockers,
  waits: currentWaits,
}: {
  blockedBy: LinkedTaskSummary[]
  blocking: LinkedTaskSummary[]
  githubBlockers: typeof githubBlockers
  waits: TaskWait[]
}) {
  return (
    <Providers>
      <div className="max-w-2xl p-6">
        <TaskDependenciesSection
          taskId={taskId}
          blockedBy={blockedBy}
          blocking={blocking}
          githubBlockers={currentGithubBlockers}
          waits={currentWaits}
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
  name: 'both blocked-by and blocking task groups are visible',
  args: {
    blockedBy: blockedByTasks,
    blocking: blockingTasks,
    githubBlockers,
    waits: [],
  },
}

export const BlockedByOnly: Story = {
  name: 'the section shows only tasks blocking the current task',
  args: {
    blockedBy: blockedByTasks,
    blocking: [],
    githubBlockers,
    waits: [],
  },
}

export const WithGitHubBlockers: Story = {
  name: 'the section shows open and resolved GitHub blockers',
  args: {
    blockedBy: [],
    blocking: [],
    githubBlockers,
    waits: [],
  },
}

export const WithWaits: Story = {
  name: 'the section keeps active and resolved reply waits visible',
  args: {
    blockedBy: blockedByTasks.slice(0, 1),
    blocking: [],
    githubBlockers: [],
    waits,
  },
}

export const Empty: Story = {
  name: 'the task has no dependencies',
  args: { blockedBy: [], blocking: [], githubBlockers: [], waits: [] },
}

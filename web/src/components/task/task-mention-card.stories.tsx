import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

import { TaskMentionCard } from '#components/task/task-mention-card'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import type { TaskDetail } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: TaskDetail = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task mention live preview',
  description:
    'Adds live preview cards for #123-style task mentions when they are the entire content of a paragraph.',
  status: 'todo',
  context: 'personal',
  commitment: 'active',
  labels: [],
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
  parentId: null,
  projectId: null,
  recurrenceRuleId: null,
  recurrenceRule: null,
  githubLinks: [],
  createdAt: '2026-03-20T00:00:00.000Z',
  updatedAt: '2026-03-20T00:00:00.000Z',
  titleAuthor: null,
  descriptionAuthor: null,
  childCompletionCount: { completed: 0, total: 0 },
  pages: [],
  timeBlocks: [],
  links: { outgoing: [], incoming: [] },
}

function Providers({
  number,
  task,
  children,
}: {
  number: number
  task: TaskDetail | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskMentionKeys.preview(number), task)

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function TaskMentionCardWithProviders({
  number,
  raw,
  task,
}: {
  number: number
  raw: string
  task: TaskDetail | null
}) {
  return (
    <Providers number={number} task={task}>
      <div className="w-full max-w-96">
        <TaskMentionCard data={{ number }} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskMentionCard',
  component: TaskMentionCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskMentionCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: baseTask,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(baseTask.title)).toBeVisible()
    await expect(canvas.getByText(baseTask.description ?? '')).toBeVisible()
  },
}

export const InProgress: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
  },
}

export const Completed: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

export const LongTitle: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: {
      ...baseTask,
      title:
        'This is a very long task title that should be clamped to two lines instead of overflowing the card layout indefinitely',
      description:
        'This is a fairly long description that should be clamped to three lines instead of overflowing the card indefinitely, so the card keeps a predictable height regardless of how verbose the underlying task description is.',
    },
  },
}

// The task preview hasn't resolved yet (or the mentioned number doesn't
// exist): the card falls back to rendering the raw matched text while its
// data is unresolved.
export const Unresolved: Story = {
  args: { number: 999, raw: '#999', task: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('#999')).toBeVisible()
  },
}

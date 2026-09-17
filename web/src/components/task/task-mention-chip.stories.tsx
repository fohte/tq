import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskMentionChip } from '#components/task/task-mention-chip'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { taskMentionKeys } from '#hooks/use-task-mentions'
import type { TaskDetail } from '#hooks/use-tasks'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask = makeTaskDetail({
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task mention live preview',
  description:
    'Adds live preview chips for #123-style task mentions in the editor.',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
})

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

function TaskMentionChipWithProviders({
  number,
  raw,
  task,
  defaultOpen,
}: {
  number: number
  raw: string
  task: TaskDetail | null
  defaultOpen?: boolean | undefined
}) {
  return (
    <Providers number={number} task={task}>
      <p className="text-sm">
        See{' '}
        <TaskMentionChip
          data={{ number }}
          raw={raw}
          defaultOpen={defaultOpen}
        />{' '}
        for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskMentionChip',
  component: TaskMentionChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskMentionChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: baseTask,
    defaultOpen: true,
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
        'This is a very long task title that should be truncated inside the chip',
    },
  },
}

// The task preview hasn't resolved yet (or the mentioned number doesn't
// exist): the chip falls back to rendering the raw matched text instead of
// a card.
export const Unresolved: Story = {
  args: { number: 999, raw: '#999', task: null },
}

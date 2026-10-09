import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { TaskMentionChip } from '#components/task/task-mention-chip'
import { makeTaskPreview } from '#components/task/task-preview-test-fixtures'
import { taskPreviewKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

type TaskPreview = ReturnType<typeof makeTaskPreview>

const baseTask = makeTaskPreview({
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task mention live preview',
  description:
    'Adds live preview chips for #123-style task mentions in the editor.',
})

function Providers({
  number,
  task,
  children,
}: {
  number: number
  task: TaskPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskPreviewKeys.preview(String(number)), task)

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
  task: TaskPreview | null
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
  name: 'a mention chip opens the preview for an unfinished task',
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: baseTask,
    defaultOpen: true,
  },
}

export const Completed: Story = {
  name: 'the mention chip represents a completed task',
  args: {
    number: baseTask.number,
    raw: `#${String(baseTask.number)}`,
    task: {
      ...baseTask,
      status: 'completed',
      statusReason: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

export const LongTitle: Story = {
  name: 'the chip truncates a long task title',
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
  name: 'the chip shows raw mention text while its task is unresolved',
  args: { number: 999, raw: '#999', task: null },
}

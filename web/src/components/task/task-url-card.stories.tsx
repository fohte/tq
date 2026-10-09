import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { makeTaskPreview } from '#components/task/task-preview-test-fixtures'
import { TaskUrlCard } from '#components/task/task-url-card'
import { taskPreviewKeys } from '#lib/query-keys'
import { StoryRouter } from '#storybook-config/story-router'

const TASK_ID = '42'
const TASK_URL = 'https://tq.fohte.net/tasks/42'
const UNRESOLVED_ID = '999'
const UNRESOLVED_URL = 'https://tq.fohte.net/tasks/999'

type TaskPreview = ReturnType<typeof makeTaskPreview>

const baseTask = makeTaskPreview({
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task URL live preview',
  description:
    'Adds live preview cards for pasted tq task URLs when they are the entire content of a paragraph.',
})

function Providers({
  id,
  task,
  children,
}: {
  id: string
  task: TaskPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskPreviewKeys.preview(id), task)

  return (
    <QueryClientProvider client={queryClient}>
      <StoryRouter
        component={() => <>{children}</>}
        paths={['/tasks/$taskId']}
      />
    </QueryClientProvider>
  )
}

function TaskUrlCardWithProviders({
  id,
  raw,
  task,
}: {
  id: string
  raw: string
  task: TaskPreview | null
}) {
  return (
    <Providers id={id} task={task}>
      <div className="w-full max-w-96">
        <TaskUrlCard data={{ id }} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskUrlCard',
  component: TaskUrlCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskUrlCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  name: 'a linked task card previews an open task',
  args: { id: TASK_ID, raw: TASK_URL, task: baseTask },
}

export const Completed: Story = {
  name: 'a linked task card previews a completed task',
  args: {
    id: TASK_ID,
    raw: TASK_URL,
    task: {
      ...baseTask,
      status: 'completed',
      statusReason: 'completed',
      title: 'Set up CI pipeline',
    },
  },
}

// The task preview hasn't resolved yet (or the id doesn't point at an
// actual task): the card falls back to rendering the raw matched text while
// its data is unresolved.
export const Unresolved: Story = {
  name: 'an unresolved task URL stays as plain text',
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, task: null },
}

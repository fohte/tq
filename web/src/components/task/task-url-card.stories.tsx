import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { TaskUrlCard } from '#components/task/task-url-card'
import type { TaskUrlPreview } from '#hooks/use-task-url-preview'
import { taskUrlPreviewKeys } from '#hooks/use-task-url-preview'
import { StoryRouter } from '#storybook-config/story-router'

const TASK_ID = '42'
const TASK_URL = 'https://tq.fohte.net/tasks/42'
const UNRESOLVED_ID = '999'
const UNRESOLVED_URL = 'https://tq.fohte.net/tasks/999'

const baseTask: TaskUrlPreview = makeTaskDetail({
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task URL live preview',
  description:
    'Adds live preview cards for pasted tq task URLs when they are the entire content of a paragraph.',
  startDate: null,
  dueDate: null,
  estimatedMinutes: null,
})

function Providers({
  id,
  task,
  children,
}: {
  id: string
  task: TaskUrlPreview | null
  children: ReactNode
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskUrlPreviewKeys.preview(id), task)

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
  task: TaskUrlPreview | null
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
  args: { id: TASK_ID, raw: TASK_URL, task: baseTask },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(baseTask.title)).toBeVisible()
    await expect(canvas.getByText(baseTask.description ?? '')).toBeVisible()
  },
}

export const Completed: Story = {
  args: {
    id: TASK_ID,
    raw: TASK_URL,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

// The task preview hasn't resolved yet (or the id doesn't point at an
// actual task): the card falls back to rendering the raw matched text while
// its data is unresolved.
export const Unresolved: Story = {
  args: { id: UNRESOLVED_ID, raw: UNRESOLVED_URL, task: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(UNRESOLVED_URL)).toBeVisible()
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

import { TagFilterChips } from '#components/tag-filter-chips'
import type { Task } from '#hooks/use-tasks'
import { taskKeys } from '#hooks/use-tasks'

const baseTask: Task = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 1,
  title: 'Implement task list UI',
  description: null,
  status: 'todo',
  context: 'personal',
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
}

const sampleTasks: Task[] = [
  { ...baseTask, id: '1', title: 'Task A', labels: ['dev:tq', 'urgent'] },
  { ...baseTask, id: '2', title: 'Task B', labels: ['dev:tq'] },
  { ...baseTask, id: '3', title: 'Task C', labels: ['urgent'] },
  { ...baseTask, id: '4', title: 'Task D', labels: ['review'] },
  {
    ...baseTask,
    id: '5',
    title: 'Task E (completed, only tag)',
    status: 'completed',
    labels: ['archived'],
  },
]

function Providers({
  children,
  tasks = sampleTasks,
}: {
  children: ReactNode
  tasks?: Task[] | undefined
}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  queryClient.setQueryData(taskKeys.list(undefined), tasks)

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

function TagFilterChipsWithProviders(props: { tasks?: Task[] }) {
  return (
    <Providers tasks={props.tasks}>
      <div className="w-[360px] border border-border">
        <TagFilterChips />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'UI/TagFilterChips',
  component: TagFilterChipsWithProviders,
} satisfies Meta<typeof TagFilterChipsWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Empty: Story = {
  args: {
    tasks: [],
  },
}

export const ToggleSelection: Story = {
  play: async ({ canvas, userEvent }) => {
    const chip = canvas.getByRole('button', { name: /dev:tq/ })
    await expect(chip).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(chip)
    await expect(chip).toHaveAttribute('aria-pressed', 'false')
  },
}

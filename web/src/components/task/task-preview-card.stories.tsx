import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import { TaskPreviewCard } from '#components/task/task-preview-card'
import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: TaskPreviewChipTask = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task URL live preview',
  description: 'Adds live preview cards for a resolved task reference.',
  status: 'todo',
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <StoryRouter component={() => <>{children}</>} paths={['/tasks/$taskId']} />
  )
}

function TaskPreviewCardWithProviders({
  raw,
  task,
}: {
  raw: string
  task: TaskPreviewChipTask | null
}) {
  return (
    <Providers>
      <div className="w-full max-w-96">
        <TaskPreviewCard task={task} raw={raw} />
      </div>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPreviewCard',
  component: TaskPreviewCardWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskPreviewCardWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  name: 'the card previews an unfinished task reference.',
  args: { raw: `#${String(baseTask.number)}`, task: baseTask },
}

export const Completed: Story = {
  name: 'the card previews a completed task reference.',
  args: {
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

export const LongTitle: Story = {
  name: 'the card clamps a long task title and description.',
  args: {
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

// The task preview hasn't resolved yet (or the reference doesn't point at an
// actual task): the card falls back to rendering the raw matched text.
export const Unresolved: Story = {
  name: 'the card shows raw reference text while the task is unresolved.',
  args: { raw: '#999', task: null },
}

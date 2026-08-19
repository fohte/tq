import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import { expect } from 'storybook/test'

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
      <div className="w-96">
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
  args: { raw: `#${String(baseTask.number)}`, task: baseTask },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(baseTask.title)).toBeVisible()
    await expect(canvas.getByText(baseTask.description ?? '')).toBeVisible()
  },
}

export const InProgress: Story = {
  args: {
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'in_progress', title: 'Review pull request' },
  },
}

export const Completed: Story = {
  args: {
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

export const LongTitle: Story = {
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
  args: { raw: '#999', task: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('#999')).toBeVisible()
  },
}

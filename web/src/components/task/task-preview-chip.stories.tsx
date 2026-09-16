import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'

import type { TaskPreviewChipTask } from '#components/task/task-preview-chip'
import { TaskPreviewChip } from '#components/task/task-preview-chip'
import { StoryRouter } from '#storybook-config/story-router'

const baseTask: TaskPreviewChipTask = {
  id: '00000000-0000-0000-0000-000000000001',
  number: 42,
  title: 'Implement task URL live preview',
  description: 'Adds live preview chips for a resolved task reference.',
  status: 'todo',
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <StoryRouter component={() => <>{children}</>} paths={['/tasks/$taskId']} />
  )
}

function TaskPreviewChipWithProviders({
  raw,
  task,
  defaultOpen,
}: {
  raw: string
  task: TaskPreviewChipTask | null
  defaultOpen?: boolean | undefined
}) {
  return (
    <Providers>
      <p className="text-sm">
        See <TaskPreviewChip task={task} raw={raw} defaultOpen={defaultOpen} />{' '}
        for details.
      </p>
    </Providers>
  )
}

const meta = {
  title: 'Task/TaskPreviewChip',
  component: TaskPreviewChipWithProviders,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TaskPreviewChipWithProviders>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    raw: `#${String(baseTask.number)}`,
    task: baseTask,
    defaultOpen: true,
  },
}

export const Completed: Story = {
  args: {
    raw: `#${String(baseTask.number)}`,
    task: { ...baseTask, status: 'completed', title: 'Set up CI pipeline' },
  },
}

// The task preview hasn't resolved yet (or the reference doesn't point at an
// actual task): the chip falls back to rendering the raw matched text
// instead of a card.
export const Unresolved: Story = {
  args: { raw: '#999', task: null },
}

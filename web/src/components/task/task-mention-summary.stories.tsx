import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskMentionSummary } from '#components/task/task-mention-summary'

const meta = {
  title: 'Task/TaskMentionSummary',
  component: TaskMentionSummary,
  parameters: {
    layout: 'centered',
  },
  render: (args) => (
    <p className="flex items-center gap-1 text-sm">
      <TaskMentionSummary {...args} />
    </p>
  ),
} satisfies Meta<typeof TaskMentionSummary>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  args: {
    status: 'todo',
    number: 42,
    title: 'Implement task mention live preview',
  },
}

export const InProgress: Story = {
  args: {
    status: 'in_progress',
    number: 7,
    title: 'Review pull request',
  },
}

export const Completed: Story = {
  args: {
    status: 'completed',
    number: 1,
    title: 'Set up CI pipeline',
  },
}

export const TruncatedTitle: Story = {
  args: {
    status: 'todo',
    number: 123,
    title:
      'This is a very long task title that should be truncated instead of wrapping',
    titleClassName: 'max-w-48',
  },
}

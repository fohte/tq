import type { Meta, StoryObj } from '@storybook/react-vite'

import { DueDateBadge } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/DueDateBadge',
  component: DueDateBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof DueDateBadge>

export default meta
type Story = StoryObj<typeof meta>

export const OnTime: Story = {
  args: {
    // Far future so this story never flips to overdue.
    dueDate: '2099-06-15',
    status: 'todo',
  },
}

export const Overdue: Story = {
  args: {
    // Fixed past date so this story always renders as overdue.
    dueDate: '2020-01-01',
    status: 'todo',
  },
}

export const OverdueCompleted: Story = {
  args: {
    dueDate: '2020-01-01',
    status: 'completed',
  },
}

export const AllVariants: Story = {
  args: {
    dueDate: '2099-06-15',
    status: 'todo',
  },
  render: () => (
    <div className="flex items-center gap-4">
      <DueDateBadge dueDate="2099-06-15" status="todo" />
      <DueDateBadge dueDate="2020-01-01" status="todo" />
      <DueDateBadge dueDate="2020-01-01" status="completed" />
    </div>
  ),
}

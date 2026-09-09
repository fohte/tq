import type { Meta, StoryObj } from '@storybook/react-vite'

import { DateRangeBadge } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/DateRangeBadge',
  component: DateRangeBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof DateRangeBadge>

export default meta
type Story = StoryObj<typeof meta>

export const BothDates: Story = {
  args: {
    startDate: '2099-06-15',
    // Far future so this story never flips to overdue.
    dueDate: '2099-06-18',
    status: 'todo',
  },
}

export const StartDateOnly: Story = {
  args: {
    startDate: '2099-06-15',
    dueDate: null,
    status: 'todo',
  },
}

export const DueDateOnly: Story = {
  args: {
    startDate: null,
    dueDate: '2099-06-18',
    status: 'todo',
  },
}

export const Overdue: Story = {
  args: {
    startDate: '2020-01-01',
    // Fixed past date so this story always renders as overdue.
    dueDate: '2020-01-05',
    status: 'todo',
  },
}

export const OverdueCompleted: Story = {
  args: {
    startDate: '2020-01-01',
    dueDate: '2020-01-05',
    status: 'completed',
  },
}

export const AllVariants: Story = {
  args: {
    startDate: '2099-06-15',
    dueDate: '2099-06-18',
    status: 'todo',
  },
  render: () => (
    <div className="flex flex-wrap items-center gap-4">
      <DateRangeBadge
        startDate="2099-06-15"
        dueDate="2099-06-18"
        status="todo"
      />
      <DateRangeBadge startDate="2099-06-15" dueDate={null} status="todo" />
      <DateRangeBadge startDate={null} dueDate="2099-06-18" status="todo" />
      <DateRangeBadge
        startDate="2020-01-01"
        dueDate="2020-01-05"
        status="todo"
      />
      <DateRangeBadge
        startDate="2020-01-01"
        dueDate="2020-01-05"
        status="completed"
      />
    </div>
  ),
}

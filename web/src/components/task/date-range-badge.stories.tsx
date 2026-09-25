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
  name: 'the badge shows both a start date and a due date',
  args: {
    startDate: '2099-06-15',
    // Far future so this story never flips to overdue.
    dueDate: '2099-06-18',
    status: 'todo',
  },
}

export const StartDateOnly: Story = {
  name: 'the badge shows only a start date',
  args: {
    startDate: '2099-06-15',
    dueDate: null,
    status: 'todo',
  },
}

export const DueDateOnly: Story = {
  name: 'the badge shows only a due date',
  args: {
    startDate: null,
    dueDate: '2099-06-18',
    status: 'todo',
  },
}

export const Overdue: Story = {
  name: 'the badge marks a task whose due date has passed',
  args: {
    startDate: '2020-01-01',
    // Fixed past date so this story always renders as overdue.
    dueDate: '2020-01-05',
    status: 'todo',
  },
}

export const OverdueCompleted: Story = {
  name: 'the badge marks an overdue task that is already completed',
  args: {
    startDate: '2020-01-01',
    dueDate: '2020-01-05',
    status: 'completed',
  },
}

export const AllVariants: Story = {
  name: 'the badge compares all available date states',
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

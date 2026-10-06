import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskDateEvent } from '#components/calendar/task-date-event'

const meta = {
  title: 'Calendar/TaskDateEvent',
  component: TaskDateEvent,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="h-8 w-80">
        <Story />
      </div>
    ),
  ],
  args: {
    title: 'Write a project note',
    dateTaskKind: 'range',
  },
} satisfies Meta<typeof TaskDateEvent>

export default meta
type Story = StoryObj<typeof meta>

export const CompleteRange: Story = {
  name: 'a task range shows both date endpoints',
  args: {
    isStart: true,
    isEnd: true,
  },
}

export const LeftClippedRange: Story = {
  name: 'a task range points left when it continues from an earlier date',
  args: {
    isStart: false,
    isEnd: true,
  },
}

export const RightClippedRange: Story = {
  name: 'a task range points right when it continues to a later date',
  args: {
    isStart: true,
    isEnd: false,
  },
}

export const BothEndsClippedRange: Story = {
  name: 'a task range points both ways between visible dates',
  args: {
    isStart: false,
    isEnd: false,
  },
}

export const DueDateOnly: Story = {
  name: 'a task with only a due date shows a flag icon',
  args: {
    dateTaskKind: 'due',
  },
}

export const StartDateOnly: Story = {
  name: 'a task with only a start date shows a play icon',
  args: {
    dateTaskKind: 'start',
  },
}

export const OverdueDueDate: Story = {
  name: 'an overdue task keeps its title readable on a pale red band',
  args: {
    dateTaskKind: 'due',
    dateTaskOverdue: true,
  },
}

export const OverdueToday: Story = {
  name: 'an overdue task shows its original due date for today',
  args: {
    dateTaskKind: 'overdue-today',
    dateTaskOverdue: true,
    dateTaskDueDateLabel: 'Oct 5',
  },
}

export const OverdueTodayInMonthView: Story = {
  name: 'a monthly overdue reminder keeps the original date visible',
  args: {
    dateTaskKind: 'overdue-today',
    dateTaskOverdue: true,
    dateTaskDueDateLabel: 'Oct 5',
    variant: 'month',
  },
}

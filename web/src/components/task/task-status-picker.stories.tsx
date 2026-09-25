import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskStatusPicker } from '#components/task/task-status-picker'

const meta = {
  title: 'Task/TaskStatusPicker',
  component: TaskStatusPicker,
  parameters: {
    layout: 'centered',
  },
  args: {
    onValueChange: fn(),
  },
} satisfies Meta<typeof TaskStatusPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  name: 'a task is marked as todo',
  args: {
    status: 'todo',
    statusReason: null,
  },
}

export const TodoOpen: Story = {
  name: 'the status picker is open for a todo task',
  args: {
    status: 'todo',
    statusReason: null,
    defaultOpen: true,
  },
}

export const Completed: Story = {
  name: 'a completed task has no completion reason',
  args: {
    status: 'completed',
    statusReason: null,
  },
}

export const NotPlannedOpen: Story = {
  name: 'the open picker shows the not-planned reason',
  args: {
    status: 'completed',
    statusReason: 'not_planned',
    defaultOpen: true,
  },
}

export const DuplicateOpen: Story = {
  name: 'the open picker shows the duplicate reason',
  args: {
    status: 'completed',
    statusReason: 'duplicate',
    defaultOpen: true,
  },
}

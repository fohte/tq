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
  args: {
    status: 'todo',
    statusReason: null,
  },
}

export const TodoOpen: Story = {
  args: {
    status: 'todo',
    statusReason: null,
    defaultOpen: true,
  },
}

export const Completed: Story = {
  args: {
    status: 'completed',
    statusReason: null,
  },
}

export const NotPlannedOpen: Story = {
  args: {
    status: 'completed',
    statusReason: 'not_planned',
    defaultOpen: true,
  },
}

export const DuplicateOpen: Story = {
  args: {
    status: 'completed',
    statusReason: 'duplicate',
    defaultOpen: true,
  },
}

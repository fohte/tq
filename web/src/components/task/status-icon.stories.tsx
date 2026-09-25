import type { Meta, StoryObj } from '@storybook/react-vite'

import { StatusIcon } from '#components/task/status-icon'

const meta = {
  title: 'Task/StatusIcon',
  component: StatusIcon,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof StatusIcon>

export default meta
type Story = StoryObj<typeof meta>

export const Todo: Story = {
  name: 'the icon indicates a task that is not yet complete.',
  args: {
    status: 'todo',
    statusReason: null,
  },
}

export const Completed: Story = {
  name: 'the icon indicates that the task is completed.',
  args: {
    status: 'completed',
    statusReason: null,
  },
}

export const NotPlanned: Story = {
  name: 'the icon indicates a task that is not planned.',
  args: {
    status: 'completed',
    statusReason: 'not_planned',
  },
}

export const Duplicate: Story = {
  name: 'the icon marks a task as a duplicate.',
  args: {
    status: 'completed',
    statusReason: 'duplicate',
  },
}

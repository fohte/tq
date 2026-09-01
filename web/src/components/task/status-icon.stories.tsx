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
  args: {
    status: 'todo',
    statusReason: null,
  },
}

export const Completed: Story = {
  args: {
    status: 'completed',
    statusReason: null,
  },
}

export const NotPlanned: Story = {
  args: {
    status: 'completed',
    statusReason: 'not_planned',
  },
}

export const Duplicate: Story = {
  args: {
    status: 'completed',
    statusReason: 'duplicate',
  },
}

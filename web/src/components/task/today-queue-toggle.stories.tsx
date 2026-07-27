import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TodayQueueToggle } from '#components/task/today-queue-toggle'

const meta = {
  title: 'Task/TodayQueueToggle',
  component: TodayQueueToggle,
  parameters: {
    layout: 'centered',
  },
  args: {
    onToggle: fn(),
  },
} satisfies Meta<typeof TodayQueueToggle>

export default meta
type Story = StoryObj<typeof meta>

export const NotInQueue: Story = {
  args: {
    inQueue: false,
  },
}

export const InQueue: Story = {
  args: {
    inQueue: true,
  },
}

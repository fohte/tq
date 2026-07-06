import type { Meta, StoryObj } from '@storybook/react-vite'
import { TodayQueueToggle } from '@web/components/task/today-queue-toggle'
import { fn } from 'storybook/test'

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

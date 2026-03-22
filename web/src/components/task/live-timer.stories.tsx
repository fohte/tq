import type { Meta, StoryObj } from '@storybook/react-vite'
import { LiveTimer } from '@web/components/task/task-row'

const meta = {
  title: 'Task/LiveTimer',
  component: LiveTimer,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof LiveTimer>

export default meta
type Story = StoryObj<typeof meta>

export const JustStarted: Story = {
  args: {
    startTime: new Date().toISOString(),
    estimatedMinutes: 30,
  },
}

export const FiveMinutesIn: Story = {
  args: {
    startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    estimatedMinutes: 30,
  },
}

export const OverEstimate: Story = {
  args: {
    startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    estimatedMinutes: 30,
  },
}

export const NoEstimate: Story = {
  args: {
    startTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    estimatedMinutes: null,
  },
}

export const LongRunning: Story = {
  args: {
    startTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    estimatedMinutes: 60,
  },
}

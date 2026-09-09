import type { Meta, StoryObj } from '@storybook/react-vite'

import { RemindBadge } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/RemindBadge',
  component: RemindBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof RemindBadge>

export default meta
type Story = StoryObj<typeof meta>

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export const LaterToday: Story = {
  args: {
    remindAt: addDays(new Date(), 0).toISOString(),
  },
}

export const Tomorrow: Story = {
  args: {
    remindAt: addDays(new Date(), 1).toISOString(),
  },
}

export const WithinAWeek: Story = {
  args: {
    remindAt: addDays(new Date(), 4).toISOString(),
  },
}

export const BeyondAWeek: Story = {
  args: {
    remindAt: addDays(new Date(), 10).toISOString(),
  },
}

import type { Meta, StoryObj } from '@storybook/react-vite'

import { RemindBadge } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/RemindBadge',
  component: RemindBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof RemindBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // Far future so the rendered year suffix never flips as wall-clock time
    // passes (see StartDateBadge's story for the same pattern).
    remindAt: '2099-06-15T09:00:00.000Z',
  },
}

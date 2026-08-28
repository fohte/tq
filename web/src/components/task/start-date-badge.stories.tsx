import type { Meta, StoryObj } from '@storybook/react-vite'

import { StartDateBadge } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/StartDateBadge',
  component: StartDateBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof StartDateBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    // Far future so the rendered year suffix never flips as wall-clock time
    // passes (see DueDateBadge's stories for the same pattern).
    startDate: '2099-06-15',
  },
}

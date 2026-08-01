import type { Meta, StoryObj } from '@storybook/react-vite'

import { ContextBadge } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/ContextBadge',
  component: ContextBadge,
  tags: ['autodocs'],
} satisfies Meta<typeof ContextBadge>

export default meta
type Story = StoryObj<typeof meta>

export const Work: Story = {
  args: {
    context: 'work',
  },
}

export const Personal: Story = {
  args: {
    context: 'personal',
  },
}

export const AllVariants: Story = {
  args: {
    context: 'work',
  },
  render: () => (
    <div className="flex items-center gap-2">
      <ContextBadge context="work" />
      <ContextBadge context="personal" />
    </div>
  ),
}

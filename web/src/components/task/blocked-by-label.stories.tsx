import type { Meta, StoryObj } from '@storybook/react-vite'

import { BlockedByLabel } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/BlockedByLabel',
  component: BlockedByLabel,
  tags: ['autodocs'],
} satisfies Meta<typeof BlockedByLabel>

export default meta
type Story = StoryObj<typeof meta>

export const SingleBlocker: Story = {
  args: {
    blockedByNumbers: [312],
  },
}

export const MultipleBlockers: Story = {
  args: {
    blockedByNumbers: [312, 315],
  },
}

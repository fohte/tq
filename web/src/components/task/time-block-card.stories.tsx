import type { Meta, StoryObj } from '@storybook/react-vite'

import { TimeBlockCard } from '#components/task/time-block-card'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'

const meta = {
  title: 'Task/TaskDetail/TimeBlockCard',
  component: TimeBlockCard,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TimeBlockCard>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: {
    block: makeTimeBlock(),
    onDelete: () => {},
  },
}

export const Auto: Story = {
  args: {
    block: makeTimeBlock({ isAutoScheduled: true }),
    onDelete: () => {},
  },
}

export const Deleting: Story = {
  args: {
    block: makeTimeBlock(),
    onDelete: () => {},
    isDeleting: true,
  },
}

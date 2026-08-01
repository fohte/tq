import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskNumberLabel } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/TaskNumberLabel',
  component: TaskNumberLabel,
  tags: ['autodocs'],
} satisfies Meta<typeof TaskNumberLabel>

export default meta
type Story = StoryObj<typeof meta>

export const SingleDigit: Story = {
  args: {
    number: 1,
  },
}

export const MultiDigit: Story = {
  args: {
    number: 4213,
  },
}

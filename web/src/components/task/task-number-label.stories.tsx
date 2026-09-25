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
  name: 'the label shows a task number with one digit',
  args: {
    number: 1,
  },
}

export const MultiDigit: Story = {
  name: 'the label shows a task number with multiple digits',
  args: {
    number: 4213,
  },
}

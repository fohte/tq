import type { Meta, StoryObj } from '@storybook/react-vite'

import { TaskContextLabel } from '#components/task/task-row-shared'

const meta = {
  title: 'Task/TaskContextLabel',
  component: TaskContextLabel,
  tags: ['autodocs'],
} satisfies Meta<typeof TaskContextLabel>

export default meta
type Story = StoryObj<typeof meta>

export const Work: Story = {
  name: 'the label marks a task as work related',
  args: {
    context: 'work',
  },
}

export const Personal: Story = {
  name: 'the label marks a task as personal',
  args: {
    context: 'personal',
  },
}

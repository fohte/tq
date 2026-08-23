import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'

import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'

const meta = {
  title: 'Task/TaskStatusFilterFields',
  component: TaskStatusFilterFields,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <div className="w-64 p-4">
        <Story />
      </div>
    ),
  ],
  args: {
    status: ['todo', 'in_progress'],
    onStatusChange: fn(),
  },
} satisfies Meta<typeof TaskStatusFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const NoneSelected: Story = {
  args: {
    status: [],
  },
}

export const AllSelected: Story = {
  args: {
    status: ['todo', 'in_progress', 'completed'],
  },
}

export const CheckCompleted: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Completed' }))
    await expect(args.onStatusChange).toHaveBeenCalledWith([
      'todo',
      'in_progress',
      'completed',
    ])
  },
}

export const UncheckTodo: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Todo' }))
    await expect(args.onStatusChange).toHaveBeenCalledWith(['in_progress'])
  },
}

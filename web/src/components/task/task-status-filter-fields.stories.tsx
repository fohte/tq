import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

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
    status: ['todo'],
    onStatusChange: fn(),
  },
} satisfies Meta<typeof TaskStatusFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const NoneSelected: Story = {
  name: 'both task statuses are unchecked',
  args: {
    status: [],
  },
}

export const AllSelected: Story = {
  name: 'todo and completed tasks are both included',
  args: {
    status: ['todo', 'completed'],
  },
}

// Unchecking the last remaining status would silently mean "show
// everything" (no is: tokens at all) rather than "show nothing" — so the
// sole checked box is disabled instead of lying about being clickable.
export const SingleSelected: Story = {
  name: 'todo remains selected as the only available status',
  args: {
    status: ['todo'],
  },
}

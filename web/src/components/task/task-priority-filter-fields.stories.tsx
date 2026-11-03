import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'
import { TaskPriorityFilterFields } from '#components/task/task-priority-filter-fields'

const meta = {
  title: 'Task/TaskPriorityFilterFields',
  component: TaskPriorityFilterFields,
  args: {
    priority: 0,
    settings: makePrioritySettings(),
    onPriorityChange: fn(),
  },
} satisfies Meta<typeof TaskPriorityFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const SelectedPriority: Story = {
  name: 'the filter marks the selected configured priority',
}

export const UnsetPriority: Story = {
  name: 'the filter marks the configured Inbox priority',
  args: { priority: null },
}

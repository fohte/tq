import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { TaskSortFilterFields } from '#components/task/task-sort-filter-fields'

const meta = {
  title: 'Task/TaskSortFilterFields',
  component: TaskSortFilterFields,
  parameters: {
    layout: 'centered',
  },
  args: {
    sortBy: 'updated',
    onSortByChange: fn(),
  },
} satisfies Meta<typeof TaskSortFilterFields>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const SortByCreated: Story = {
  args: {
    sortBy: 'created',
  },
}

export const SortByDue: Story = {
  args: {
    sortBy: 'due',
  },
}

export const SortByEstimate: Story = {
  args: {
    sortBy: 'estimate',
  },
}

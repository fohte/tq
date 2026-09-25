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

export const Default: Story = {
  name: 'tasks are sorted by their last update',
}

export const SortByCreated: Story = {
  name: 'tasks are sorted by creation time',
  args: {
    sortBy: 'created',
  },
}

export const SortByDue: Story = {
  name: 'tasks are sorted by due date',
  args: {
    sortBy: 'due',
  },
}

export const SortByEstimate: Story = {
  name: 'tasks are sorted by estimated duration',
  args: {
    sortBy: 'estimate',
  },
}

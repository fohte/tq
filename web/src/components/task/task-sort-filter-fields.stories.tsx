import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent } from 'storybook/test'

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

export const ChangeSort: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Created' }))
    await expect(args.onSortByChange).toHaveBeenCalledWith('created')
  },
}

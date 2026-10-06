import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { QueueScheduledItemRow } from '#components/task/queue-scheduled-item-row'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

const meta = {
  title: 'Task/QueueScheduledItemRow',
  component: QueueScheduledItemRow,
  parameters: { layout: 'centered' },
  decorators: [
    (Story) => (
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        <div className="w-full max-w-96 border border-border">
          <Story />
        </div>
      </MemoizedStoryRouter>
    ),
  ],
  args: {
    task: makeTask({
      id: 'scheduled-task',
      title: 'Review the launch notes',
      estimatedMinutes: 45,
    }),
    date: '2026-08-11',
    onRemove: fn(),
  },
} satisfies Meta<typeof QueueScheduledItemRow>

export default meta
type Story = StoryObj<typeof meta>

export const Scheduled: Story = {
  name: 'a dated queue task uses one muted line without its number or estimate',
}

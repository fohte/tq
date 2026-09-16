import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ComponentType } from 'react'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { SidebarPlanField } from '#components/task/sidebar-plan-field'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import { formatLocalDate } from '#lib/date-range'

const taskId = '00000000-0000-0000-0000-000000000001'
const today = formatLocalDate(new Date())

function toQueueItems(prefix: string, taskIds: string[]) {
  return taskIds.map((id, index) =>
    makeQueueItem({
      id: `${prefix}-${String(index)}`,
      taskId: id,
      sortOrder: index,
    }),
  )
}

function seedQueues(
  queryClient: QueryClient,
  dayTaskIds: string[],
  weekTaskIds: string[],
) {
  queryClient.setQueryData(
    queueKeys.items(DAY_QUEUE_KEY, today),
    toQueueItems('day', dayTaskIds),
  )
  queryClient.setQueryData(
    queueKeys.items(WEEK_QUEUE_KEY, today),
    toQueueItems('week', weekTaskIds),
  )
}

function withSeededQueues(dayTaskIds: string[], weekTaskIds: string[]) {
  return (Story: ComponentType) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    seedQueues(queryClient, dayTaskIds, weekTaskIds)
    return (
      <QueryClientProvider client={queryClient}>
        <div className="w-60 border-l border-border p-4">
          <Story />
        </div>
      </QueryClientProvider>
    )
  }
}

const meta = {
  title: 'Task/TaskDetail/SidebarPlanField',
  component: SidebarPlanField,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof SidebarPlanField>

export default meta
type Story = StoryObj<typeof meta>

export const NoPlan: Story = {
  decorators: [withSeededQueues([], [])],
  args: { taskId, commitment: 'active' },
}

export const InTodayQueue: Story = {
  decorators: [withSeededQueues(['other-task', taskId, 'other-task-2'], [])],
  args: { taskId, commitment: 'active' },
}

export const InThisWeekQueue: Story = {
  decorators: [withSeededQueues([], [taskId])],
  args: { taskId, commitment: 'active' },
}

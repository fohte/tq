import { closestCenter, DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { fn } from 'storybook/test'

import { QueueSection } from '#components/task/queue-section'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        {children}
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

const meta = {
  title: 'Task/QueueSection',
  component: QueueSection,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-full max-w-96 border border-border">
          <DndContext collisionDetection={closestCenter}>
            <Story />
          </DndContext>
        </div>
      </Providers>
    ),
  ],
  args: {
    onRemove: fn(),
  },
} satisfies Meta<typeof QueueSection>

export default meta
type Story = StoryObj<typeof meta>

export const DayQueue: Story = {
  args: {
    queueKey: 'day',
    title: 'today',
    dateRangeLabel: '09-01',
    emptyMessage: "No tasks in today's queue",
    items: [
      makeTask({
        id: '1',
        title: 'Write the quarterly report',
        context: 'work',
        estimatedMinutes: 30,
      }),
      makeTask({ id: '2', title: 'Plan the launch', estimatedMinutes: null }),
    ],
  },
}

export const StaticQueueWithoutRange: Story = {
  args: {
    queueKey: 'someday',
    title: 'someday',
    emptyMessage: "No tasks in someday's queue",
    items: [
      makeTask({
        id: '1',
        title: 'Renew SSL certificate',
        estimatedMinutes: 15,
      }),
    ],
  },
}

export const Empty: Story = {
  args: {
    queueKey: 'week',
    title: 'this week',
    dateRangeLabel: '08-31 – 09-06',
    emptyMessage: "No tasks in this week's queue",
    items: [],
  },
}

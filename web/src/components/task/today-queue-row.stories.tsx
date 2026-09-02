import { closestCenter, DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { fn } from 'storybook/test'

import { makeTask as makeBaseTask } from '#components/task/task-row-test-fixtures'
import { TodayQueueRow } from '#components/task/today-queue-row'
import type { Task } from '#hooks/use-tasks'
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

function makeTask(overrides: Partial<Task> = {}): Task {
  return makeBaseTask({
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Write the quarterly report',
    context: 'work',
    estimatedMinutes: 30,
    ...overrides,
  })
}

const meta = {
  title: 'Task/TodayQueueRow',
  component: TodayQueueRow,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <Providers>
        <div className="w-full max-w-96">
          <DndContext collisionDetection={closestCenter}>
            <SortableContext
              items={['00000000-0000-0000-0000-000000000001']}
              strategy={verticalListSortingStrategy}
            >
              <Story />
            </SortableContext>
          </DndContext>
        </div>
      </Providers>
    ),
  ],
  args: {
    onRemove: fn(),
  },
} satisfies Meta<typeof TodayQueueRow>

export default meta
type Story = StoryObj<typeof meta>

export const WithEstimate: Story = {
  args: {
    task: makeTask(),
  },
}

export const MissingEstimate: Story = {
  args: {
    task: makeTask({ estimatedMinutes: null, title: 'Plan the launch' }),
  },
}

export const Overdue: Story = {
  args: {
    // Fixed past date so this story always renders as overdue.
    task: makeTask({ title: 'Renew SSL certificate', dueDate: '2020-01-01' }),
  },
}

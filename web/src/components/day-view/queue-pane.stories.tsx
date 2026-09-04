import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'

import { QueuePane } from '#components/day-view/queue-pane'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { getQueueCandidates } from '#lib/queue-candidates'
import { MemoizedStoryRouter } from '#storybook-config/story-router'

function Providers({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoizedStoryRouter paths={['/tasks/$taskId']}>
        {children}
      </MemoizedStoryRouter>
    </QueryClientProvider>
  )
}

const dayTasks = [
  makeTask({ id: '1', title: 'Write the quarterly report', context: 'work' }),
  makeTask({ id: '2', title: 'Plan the launch', estimatedMinutes: null }),
]

const weekTasks = [
  makeTask({
    id: '3',
    title: 'Fix the queue schema',
    estimatedMinutes: 120,
  }),
]

const candidateTasks = [
  makeTask({
    id: '4',
    title: 'Fix the flaky test',
    dueDate: '2020-01-01',
    context: 'work',
  }),
]

const meta = {
  title: 'DayView/QueuePane',
  component: QueuePane,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <Providers>
        <div
          className="w-full max-w-96 border border-border"
          style={{ height: 600 }}
        >
          <Story />
        </div>
      </Providers>
    ),
  ],
  args: {
    onReorderQueue: fn(),
    onMoveTask: fn(),
    onInsertCandidate: fn(),
    onAddCandidate: fn(),
    onRemoveFromQueue: fn(),
  },
} satisfies Meta<typeof QueuePane>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    isLoading: false,
    queueSections: [
      {
        key: 'day',
        title: 'today',
        items: dayTasks,
        dateRangeLabel: '09-01',
        emptyMessage: "No tasks in today's queue",
      },
      {
        key: 'week',
        title: 'this week',
        items: weekTasks,
        dateRangeLabel: '08-31 – 09-06',
        emptyMessage: "No tasks in this week's queue",
      },
    ],
    queueCandidates: getQueueCandidates(candidateTasks, new Set()),
  },
}

export const Empty: Story = {
  args: {
    isLoading: false,
    queueSections: [
      {
        key: 'day',
        title: 'today',
        items: [],
        dateRangeLabel: '09-01',
        emptyMessage: "No tasks in today's queue",
      },
      {
        key: 'week',
        title: 'this week',
        items: [],
        dateRangeLabel: '08-31 – 09-06',
        emptyMessage: "No tasks in this week's queue",
      },
    ],
    queueCandidates: [],
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
    queueSections: [],
    queueCandidates: [],
  },
}

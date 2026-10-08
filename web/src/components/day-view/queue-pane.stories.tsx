import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { fn } from 'storybook/test'

import { QueuePane } from '#components/day-view/queue-pane'
import { makeQueueSectionData } from '#components/day-view/queue-pane-test-fixtures'
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
]

const weekTasks = [
  makeTask({
    id: '3',
    title: 'Fix the queue schema',
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
        <div className="h-150 w-full max-w-96 border border-border">
          <Story />
        </div>
      </Providers>
    ),
  ],
  args: {
    queueDate: '2026-01-01',
    onMoveTask: fn(),
    onInsertCandidate: fn(),
    onRemoveFromQueue: fn(),
    onMoveScheduledTaskToWeek: fn(),
  },
} satisfies Meta<typeof QueuePane>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  name: 'the queue pane shows future scheduled tasks beneath this week',
  args: {
    isLoading: false,
    queueSections: [
      makeQueueSectionData({
        key: 'day',
        title: 'today',
        items: dayTasks,
        dateRangeLabel: '09-01',
        emptyMessage: "No tasks in today's queue",
      }),
      makeQueueSectionData({
        key: 'week',
        title: 'this week',
        items: weekTasks,
        dayGroups: [
          {
            date: '2026-09-02',
            label: 'Wed 09-02',
            items: [
              makeTask({
                id: '5',
                title: 'Review the release checklist',
              }),
            ],
          },
        ],
        dateRangeLabel: '08-31 – 09-06',
        emptyMessage: "No tasks in this week's queue",
      }),
    ],
    queueCandidates: getQueueCandidates(candidateTasks, new Set()),
  },
}

export const Empty: Story = {
  name: 'the queue pane shows empty messages for today and this week',
  args: {
    isLoading: false,
    queueSections: [
      makeQueueSectionData({
        key: 'day',
        title: 'today',
        items: [],
        dateRangeLabel: '09-01',
        emptyMessage: "No tasks in today's queue",
      }),
      makeQueueSectionData({
        key: 'week',
        title: 'this week',
        items: [],
        dayGroups: [],
        dateRangeLabel: '08-31 – 09-06',
        emptyMessage: "No tasks in this week's queue",
      }),
    ],
    queueCandidates: [],
  },
}

export const Loading: Story = {
  name: 'the queue pane shows loading placeholders for its sections',
  args: {
    isLoading: true,
    queueSections: [],
    queueCandidates: [],
  },
}

import { closestCenter, DndContext } from '@dnd-kit/core'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { fn } from 'storybook/test'

import { QueueSection } from '#components/task/queue-section'
import { makeTask } from '#components/task/task-row-test-fixtures'
import { makeTaskRowTimeBlockState } from '#components/task/task-row-time-block-test-fixtures'
import { formatLocalDate } from '#lib/date-range'
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

const today = new Date()
const todayDate = formatLocalDate(today)
const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)
const yesterdayDate = formatLocalDate(yesterday)

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
    onMoveScheduledTaskToWeek: fn(),
    queueDate: '2026-01-01',
  },
} satisfies Meta<typeof QueueSection>

export default meta
type Story = StoryObj<typeof meta>

export const DayQueue: Story = {
  name: 'the day queue contains tasks scheduled for today',
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
      }),
    ],
  },
}

export const DueToday: Story = {
  name: 'the due today section lists overdue tasks before tasks due today',
  args: {
    queueKey: 'due-today',
    title: 'due today',
    isReadOnly: true,
    emptyMessage: 'No tasks due today',
    items: [
      makeTask({
        id: '1',
        title: 'Send the revised pricing',
        dueDate: yesterdayDate,
      }),
      makeTask({
        id: '2',
        title: 'Review the access request',
        dueDate: todayDate,
      }),
    ],
    taskRowStates: new Map([
      [
        '1',
        makeTaskRowTimeBlockState({
          timeRanges: ['08:30–09:00'],
          blockEndedAt: '09:00',
        }),
      ],
    ]),
  },
}

export const ScheduledTask: Story = {
  name: "a queued task shows today's work block time",
  args: {
    queueKey: 'day',
    title: 'today',
    emptyMessage: "No tasks in today's queue",
    items: [
      makeTask({ id: 'scheduled-task', title: 'Prepare the release notes' }),
    ],
    taskRowStates: new Map([
      [
        'scheduled-task',
        makeTaskRowTimeBlockState({ timeRanges: ['10:00–10:30'] }),
      ],
    ]),
  },
}

export const WeekWithScheduledDays: Story = {
  name: 'this week keeps undated tasks above its scheduled day groups',
  args: {
    queueKey: 'week',
    title: 'this week',
    items: [
      makeTask({
        id: 'week-task',
        title: 'Prepare the weekly summary',
      }),
    ],
    dayGroups: [
      {
        date: '2026-08-11',
        label: 'Tue 08-11',
        items: [
          makeTask({
            id: 'tuesday-task',
            title: 'Review the release notes',
          }),
          makeTask({
            id: 'tuesday-task-2',
            title: 'Check the dashboard',
          }),
        ],
      },
    ],
    emptyMessage: "No tasks in this week's queue",
  },
}

export const WeekWithOnlyScheduledDays: Story = {
  name: 'the week shows scheduled day groups when it has no undated tasks',
  args: {
    queueKey: 'week',
    title: 'this week',
    items: [],
    dayGroups: [
      {
        date: '2026-08-12',
        label: 'Wed 08-12',
        items: [
          makeTask({
            id: 'wednesday-task',
            title: 'Check the deployment notes',
          }),
        ],
      },
    ],
    emptyMessage: "No tasks in this week's queue",
  },
}

export const CurrentWorkBlock: Story = {
  name: 'a queued task has a stronger background during its current work block',
  args: {
    queueKey: 'day',
    title: 'today',
    emptyMessage: "No tasks in today's queue",
    items: [
      makeTask({ id: 'current-task', title: 'Review the handoff notes' }),
    ],
    taskRowStates: new Map([
      [
        'current-task',
        makeTaskRowTimeBlockState({
          timeRanges: ['09:00–09:30'],
          isCurrentTimeBlock: true,
        }),
      ],
    ]),
  },
}

export const StaticQueueWithoutRange: Story = {
  name: 'the static queue contains tasks without a date range',
  args: {
    queueKey: 'someday',
    title: 'someday',
    emptyMessage: "No tasks in someday's queue",
    items: [
      makeTask({
        id: '1',
        title: 'Renew SSL certificate',
      }),
    ],
  },
}

export const Empty: Story = {
  name: 'the queue shows its empty message without scheduled tasks',
  args: {
    queueKey: 'week',
    title: 'this week',
    dateRangeLabel: '08-31 – 09-06',
    emptyMessage: "No tasks in this week's queue",
    items: [],
  },
}

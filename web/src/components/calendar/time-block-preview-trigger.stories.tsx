import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { makeTaskDetail } from '#components/task/task-row-test-fixtures'
import { DAY_QUEUE_KEY, queueKeys } from '#hooks/use-queues'
import { taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'

const taskId = '00000000-0000-0000-0000-000000000001'

const taskFixture = makeTaskDetail({
  id: taskId,
  number: 12,
  title: 'Write onboarding doc',
})

function Chip({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center bg-primary/20 px-1 text-2xs">
      {label}
    </div>
  )
}

const manualEvent = {
  id: 'block-manual',
  start: new Date('2026-07-29T16:00:00.000Z'),
  end: new Date('2026-07-29T16:45:00.000Z'),
  extendedProps: {
    type: 'manual' as const,
    taskId,
    isAutoScheduled: false,
  },
}

const autoEvent = {
  id: 'block-auto',
  start: new Date('2026-07-30T10:00:00.000Z'),
  end: new Date('2026-07-30T11:30:00.000Z'),
  extendedProps: {
    type: 'auto' as const,
    taskId,
    isAutoScheduled: true,
  },
}

const autoEventLocalDate = formatLocalDate(autoEvent.start)

const redactedEvent = {
  id: 'block-redacted',
  start: new Date('2026-07-29T16:00:00.000Z'),
  end: new Date('2026-07-29T16:45:00.000Z'),
  extendedProps: {
    type: 'manual' as const,
    taskId,
    isAutoScheduled: false,
    redacted: true,
  },
}

const meta = {
  title: 'Calendar/TimeBlockPreviewTrigger',
  component: TimeBlockPreviewTrigger,
  parameters: {
    layout: 'centered',
  },
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        // staleTime: Infinity keeps the seeded data below from being
        // refetched on mount — useTask/useQueueItems default to staleTime: 0.
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      })
      queryClient.setQueryData(taskKeys.detail(taskId), taskFixture)
      queryClient.setQueryData(
        queueKeys.items(DAY_QUEUE_KEY, autoEventLocalDate),
        [makeQueueItem({ taskId, periodStart: autoEventLocalDate })],
      )

      return (
        <QueryClientProvider client={queryClient}>
          <div style={{ width: 160, height: 48 }}>
            <Story />
          </div>
        </QueryClientProvider>
      )
    },
  ],
} satisfies Meta<typeof TimeBlockPreviewTrigger>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: {
    event: manualEvent,
    children: <Chip label="Manual task" />,
    defaultOpen: true,
  },
}

export const Auto: Story = {
  args: {
    event: autoEvent,
    children: <Chip label="Auto task" />,
    defaultOpen: true,
  },
}

export const Redacted: Story = {
  args: {
    event: redactedEvent,
    children: <Chip label="Busy" />,
  },
}

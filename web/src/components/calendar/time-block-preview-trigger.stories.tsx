import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import {
  autoEvent,
  manualEvent,
  redactedEvent,
  taskFixture,
  taskId,
} from '#components/calendar/time-block-preview-trigger-test-fixtures'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { DAY_QUEUE_KEY, queueKeys } from '#hooks/use-queues'
import { taskKeys } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'

function Chip({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center bg-primary/20 px-1 text-2xs">
      {label}
    </div>
  )
}

const autoEventLocalDate = formatLocalDate(autoEvent.start)

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
          <div className="h-12 w-40">
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
  name: 'a manually scheduled task opens a preview with its details',
  args: {
    event: manualEvent,
    children: <Chip label="Manual task" />,
    defaultOpen: true,
  },
}

export const Auto: Story = {
  name: 'an automatically scheduled task opens a preview with its details',
  args: {
    event: autoEvent,
    children: <Chip label="Auto task" />,
    defaultOpen: true,
  },
}

export const Redacted: Story = {
  name: 'a private calendar block appears as a busy chip without a preview',
  args: {
    event: redactedEvent,
    children: <Chip label="Busy" />,
  },
}

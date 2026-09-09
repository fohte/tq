import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, fireEvent, userEvent, waitFor, within } from 'storybook/test'

import { TimeBlockPreviewTrigger } from '#components/calendar/time-block-preview-trigger'
import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { DAY_QUEUE_KEY } from '#hooks/use-queues'
import { formatLocalDate } from '#lib/date-range'

const taskId = '00000000-0000-0000-0000-000000000001'

// Stands in for EventBlock's rendered chip: this file only exercises the
// hover-card wiring, not the chip's own appearance (covered by
// event-block.stories.tsx).
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

function autoBlockQueueItems() {
  return [makeQueueItem({ taskId, periodStart: autoEventLocalDate })]
}

// A schedule event never carries a taskId, so this is the "chip unchanged"
// passthrough case alongside a redacted task block.
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
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <div style={{ width: 160, height: 48 }}>
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof TimeBlockPreviewTrigger>

export default meta
type Story = StoryObj<typeof meta>

export const Manual: Story = {
  args: {
    event: manualEvent,
    children: <Chip label="Manual task" />,
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.hover(canvas.getByText('Manual task'))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText('manual')).toBeVisible())
  },
}

let deletedTimeBlockId: string | null = null

export const DeleteManualBlock: Story = {
  args: {
    event: manualEvent,
    children: <Chip label="Manual task" />,
  },
  parameters: {
    msw: {
      handlers: [
        http.delete('/api/schedule/time-blocks/:id', ({ params }) => {
          const id = params['id']
          deletedTimeBlockId = typeof id === 'string' ? id : null
          return new HttpResponse(null, { status: 204 })
        }),
      ],
    },
  },
  play: async ({ canvas, canvasElement }) => {
    deletedTimeBlockId = null
    await userEvent.hover(canvas.getByText('Manual task'))
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      await body.findByRole('button', { name: 'Delete time block' }),
    )
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await waitFor(async () => {
      await expect(deletedTimeBlockId).toBe(manualEvent.id)
    })
  },
}

export const Auto: Story = {
  args: {
    event: autoEvent,
    children: <Chip label="Auto task" />,
  },
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/queues/${DAY_QUEUE_KEY}/items`, () =>
          HttpResponse.json(autoBlockQueueItems()),
        ),
      ],
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.hover(canvas.getByText('Auto task'))
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() => expect(body.getByText('auto')).toBeVisible())
  },
}

let putQueueItemsBody: unknown = null

export const RemoveAutoBlockFromQueue: Story = {
  args: {
    event: autoEvent,
    children: <Chip label="Auto task" />,
  },
  parameters: {
    msw: {
      handlers: [
        http.get(`/api/queues/${DAY_QUEUE_KEY}/items`, () =>
          HttpResponse.json(autoBlockQueueItems()),
        ),
        http.put(`/api/queues/${DAY_QUEUE_KEY}/items`, async ({ request }) => {
          putQueueItemsBody = await request.json()
          return HttpResponse.json([])
        }),
      ],
    },
  },
  play: async ({ canvas, canvasElement }) => {
    putQueueItemsBody = null
    await userEvent.hover(canvas.getByText('Auto task'))
    const body = within(canvasElement.ownerDocument.body)

    // The trash button is disabled while the day's queue items are loading
    // (useRemoveFromDayQueue needs them to know which task to drop on delete).
    const trashButton = await waitFor(async () => {
      const button = body.getByRole('button', { name: 'Remove from queue' })
      await expect(button).toBeEnabled()
      return button
    })
    await userEvent.click(trashButton)
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await waitFor(async () => {
      await expect(putQueueItemsBody).toEqual({
        date: autoEventLocalDate,
        taskIds: [],
      })
    })
  },
}

export const Redacted: Story = {
  args: {
    event: redactedEvent,
    children: <Chip label="Busy" />,
  },
  play: async ({ canvas, canvasElement }) => {
    await userEvent.hover(canvas.getByText('Busy'))
    const body = within(canvasElement.ownerDocument.body)
    await expect(body.queryByRole('button')).toBeNull()
  },
}

export const ClosesOnPointerDown: Story = {
  args: {
    event: manualEvent,
    children: <Chip label="Manual task" />,
  },
  play: async ({ canvas, canvasElement }) => {
    const chip = canvas.getByText('Manual task')
    await userEvent.hover(chip)
    const body = within(canvasElement.ownerDocument.body)
    await waitFor(() =>
      expect(
        body.getByRole('button', { name: 'Delete time block' }),
      ).toBeVisible(),
    )

    await fireEvent.pointerDown(chip)

    await waitFor(() =>
      expect(
        body.queryByRole('button', { name: 'Delete time block' }),
      ).toBeNull(),
    )
  },
}

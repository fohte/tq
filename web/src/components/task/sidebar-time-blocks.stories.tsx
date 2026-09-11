import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { SidebarTimeBlocks } from '#components/task/sidebar-time-blocks'
import { makeTimeBlock } from '#components/task/time-block-test-fixtures'
import { DAY_QUEUE_KEY } from '#hooks/use-queues'
import { formatLocalDate } from '#lib/date-range'

const taskId = '00000000-0000-0000-0000-000000000001'

const manualBlock = makeTimeBlock({
  id: 'block-manual',
  taskId,
  startTime: '2026-07-29T16:00:00.000Z',
  endTime: '2026-07-29T16:45:00.000Z',
  isAutoScheduled: false,
})

const autoBlock = makeTimeBlock({
  id: 'block-auto',
  taskId,
  startTime: '2026-07-30T10:00:00.000Z',
  endTime: '2026-07-30T11:30:00.000Z',
  isAutoScheduled: true,
})

const autoBlockLocalDate = formatLocalDate(new Date(autoBlock.startTime))

function autoBlockQueueItems() {
  return [
    makeQueueItem({
      taskId,
      periodStart: autoBlockLocalDate,
      createdAt: autoBlock.createdAt,
      updatedAt: autoBlock.updatedAt,
    }),
  ]
}

const meta = {
  title: 'Task/TaskDetail/SidebarTimeBlocks',
  component: SidebarTimeBlocks,
  parameters: {
    layout: 'padded',
  },
  decorators: [
    (Story) => (
      <QueryClientProvider
        client={
          new QueryClient({ defaultOptions: { queries: { retry: false } } })
        }
      >
        <div className="max-w-sm border border-border">
          <Story />
        </div>
      </QueryClientProvider>
    ),
  ],
} satisfies Meta<typeof SidebarTimeBlocks>

export default meta
type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    taskId,
    timeBlocks: [],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByText('TIME BLOCKS')).toBeNull()
  },
}

export const WithManualAndAutoBlocks: Story = {
  args: {
    taskId,
    timeBlocks: [autoBlock, manualBlock],
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
}

let deletedTimeBlockId: string | null = null

export const DeleteManualBlock: Story = {
  args: {
    taskId,
    timeBlocks: [manualBlock],
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
    // Whether the delete trigger's focus ring survives the dialog closing
    // depends on the race between the mutation settling (which disables the
    // trigger via `isDeleting`, blurring it per the HTML focus-fixup rule)
    // and Base UI restoring focus to it, so the capture is flaky in CI.
    // WithManualAndAutoBlocks already covers this row's appearance.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    deletedTimeBlockId = null
    const body = within(canvasElement.ownerDocument.body)

    await userEvent.click(
      body.getByRole('button', { name: 'Delete time block' }),
    )
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await waitFor(async () => {
      await expect(deletedTimeBlockId).toBe(manualBlock.id)
    })
  },
}

let putQueueItemsBody: unknown = null

export const RemoveAutoBlockFromQueue: Story = {
  args: {
    taskId,
    timeBlocks: [autoBlock],
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
    // Same focus-ring race as DeleteManualBlock's screenshot skip above.
    // WithManualAndAutoBlocks already covers this row's appearance.
    screenshot: { skip: true },
  },
  play: async ({ canvasElement }) => {
    putQueueItemsBody = null
    const body = within(canvasElement.ownerDocument.body)

    // The trash button is disabled while the day's queue items are loading
    // (AutoTimeBlockRow needs them to know which task to drop on delete).
    const trashButton = await waitFor(async () => {
      const button = body.getByRole('button', { name: 'Remove from queue' })
      await expect(button).toBeEnabled()
      return button
    })
    await userEvent.click(trashButton)
    await userEvent.click(await body.findByRole('button', { name: 'Delete' }))

    await waitFor(async () => {
      await expect(putQueueItemsBody).toEqual({
        date: autoBlockLocalDate,
        taskIds: [],
      })
    })
  },
}

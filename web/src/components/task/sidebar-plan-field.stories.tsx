import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ComponentType } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { SidebarPlanField } from '#components/task/sidebar-plan-field'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import { formatLocalDate } from '#lib/date-range'

const taskId = '00000000-0000-0000-0000-000000000001'
const today = formatLocalDate(new Date())

function seedQueues(
  queryClient: QueryClient,
  dayTaskIds: string[],
  weekTaskIds: string[],
) {
  queryClient.setQueryData(
    queueKeys.items(DAY_QUEUE_KEY, today),
    dayTaskIds.map((id, index) =>
      makeQueueItem({
        id: `day-${String(index)}`,
        taskId: id,
        sortOrder: index,
      }),
    ),
  )
  queryClient.setQueryData(
    queueKeys.items(WEEK_QUEUE_KEY, today),
    weekTaskIds.map((id, index) =>
      makeQueueItem({
        id: `week-${String(index)}`,
        taskId: id,
        sortOrder: index,
      }),
    ),
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

let putBody: unknown = null
let patchedBody: unknown = null

export const SelectsTodayUpgradesInboxCommitment: Story = {
  decorators: [withSeededQueues([], [])],
  args: { taskId, commitment: 'inbox' },
  parameters: {
    msw: {
      handlers: [
        http.put('/api/queues/:key/items', async ({ request, params }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- this story controls the request body it sends (useSetQueueItems's mutate call) in the play function below
          const body = (await request.json()) as {
            date: string
            taskIds: string[]
          }
          putBody = { key: params['key'], ...body }
          return HttpResponse.json([])
        }),
        http.patch('/api/tasks/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({})
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    putBody = null
    patchedBody = null
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByText('today'))

    await waitFor(async () => {
      await expect(putBody).toEqual({
        key: 'day',
        date: today,
        taskIds: [taskId],
      })
    })
    await waitFor(async () => {
      await expect(patchedBody).toEqual({ commitment: 'active' })
    })
  },
}

export const ClearingPlanDoesNotChangeCommitment: Story = {
  decorators: [withSeededQueues([taskId], [])],
  args: { taskId, commitment: 'active' },
  parameters: {
    msw: {
      handlers: [
        http.put('/api/queues/:key/items', async ({ request, params }) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- this story controls the request body it sends (useSetQueueItems's mutate call) in the play function below
          const body = (await request.json()) as {
            date: string
            taskIds: string[]
          }
          putBody = { key: params['key'], ...body }
          return HttpResponse.json([])
        }),
        http.patch('/api/tasks/:id', async ({ request }) => {
          patchedBody = await request.json()
          return HttpResponse.json({})
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    putBody = null
    patchedBody = null
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByText('—'))

    await waitFor(async () => {
      await expect(putBody).toEqual({ key: 'day', date: today, taskIds: [] })
    })
    await expect(patchedBody).toBeNull()
  },
}

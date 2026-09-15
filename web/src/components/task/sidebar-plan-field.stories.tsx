import type { Meta, StoryObj } from '@storybook/react-vite'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import type { ComponentType } from 'react'
import { expect, userEvent, waitFor, within } from 'storybook/test'

import { makeQueueItem } from '#components/task/queue-item-test-fixtures'
import { SidebarPlanField } from '#components/task/sidebar-plan-field'
import { DAY_QUEUE_KEY, queueKeys, WEEK_QUEUE_KEY } from '#hooks/use-queues'
import { formatLocalDate } from '#lib/date-range'
import { assertDefined, readQueuePutBody } from '#lib/test-utils'

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

// Captured so a play function can inspect cache state (e.g. whether a query
// was invalidated) after an interaction — the QueryClient itself isn't
// exposed through Storybook's play-function context.
let capturedQueryClient: QueryClient | null = null

function withSeededQueues(dayTaskIds: string[], weekTaskIds: string[]) {
  return (Story: ComponentType) => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    })
    seedQueues(queryClient, dayTaskIds, weekTaskIds)
    capturedQueryClient = queryClient
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

// Mirrors PUT /api/queues/:key/items' real contract (see
// api/src/routes/queues.ts) of echoing back the resulting item list, so a
// story's post-`play` render reflects the queue it actually asked for
// instead of always looking empty.
function echoQueueItems(taskIds: string[]) {
  return taskIds.map((id, index) =>
    makeQueueItem({
      id: `item-${String(index)}`,
      taskId: id,
      sortOrder: index,
    }),
  )
}

export const SelectsTodayUpgradesInboxCommitment: Story = {
  decorators: [withSeededQueues([], [])],
  args: { taskId, commitment: 'inbox' },
  parameters: {
    msw: {
      handlers: [
        http.put('/api/queues/:key/items', async ({ request, params }) => {
          const body = await readQueuePutBody(request)
          putBody = { key: params['key'], ...body }
          return HttpResponse.json(echoQueueItems(body.taskIds))
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
    // Clearing the plan always empties the queue, so this ends up rendering
    // the same "no plan" state as NoPlan — the play only proves the request
    // shape, not a distinct look.
    screenshot: { skip: true },
    msw: {
      handlers: [
        http.put('/api/queues/:key/items', async ({ request, params }) => {
          const body = await readQueuePutBody(request)
          putBody = { key: params['key'], ...body }
          return HttpResponse.json(echoQueueItems(body.taskIds))
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

export const SwitchingFromTodayToThisWeekMovesTheTask: Story = {
  decorators: [withSeededQueues([taskId], [])],
  args: { taskId, commitment: 'active' },
  parameters: {
    // Ends with the task 1st of 1 in this week's queue, same as
    // InThisWeekQueue's seeded state — the play only proves the request
    // shape and cache invalidation, not a distinct look.
    screenshot: { skip: true },
    msw: {
      handlers: [
        // useTaskPlan's setPlan invalidates the day queue's cache after the
        // week PUT succeeds; the day queue is still mounted (this component
        // always queries both), so invalidation triggers a real refetch.
        http.get('/api/queues/:key/items', () => HttpResponse.json([])),
        http.put('/api/queues/:key/items', async ({ request, params }) => {
          const body = await readQueuePutBody(request)
          putBody = { key: params['key'], ...body }
          return HttpResponse.json(echoQueueItems(body.taskIds))
        }),
      ],
    },
  },
  play: async ({ canvasElement }) => {
    putBody = null
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByText('this week'))

    await waitFor(async () => {
      await expect(putBody).toEqual({
        key: 'week',
        date: today,
        taskIds: [taskId],
      })
    })
    await waitFor(async () => {
      await expect(
        assertDefined(capturedQueryClient).getQueryData(
          queueKeys.items(DAY_QUEUE_KEY, today),
        ),
      ).toEqual([])
    })
  },
}

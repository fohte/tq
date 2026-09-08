import { asc } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotification } from 'web-push'

import { db } from '#db/connection'
import { pushSubscriptions, tasks } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { deliverDueReminders } from '#services/task-reminders'
import { setupTestDb } from '#testing'

vi.mock('web-push', async (importOriginal) => ({
  ...(await importOriginal<typeof import('web-push')>()),
  sendNotification: vi.fn(),
}))

setupTestDb()

beforeEach(() => {
  vi.mocked(sendNotification).mockReset().mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  })
})

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

const WORK_ENDPOINT = 'https://push.example.com/work-laptop'
const PERSONAL_ENDPOINT = 'https://push.example.com/home-laptop'

async function register(endpoint: string, context: 'work' | 'personal') {
  await db.insert(pushSubscriptions).values({
    endpoint,
    p256dh: 'p256dh-key',
    auth: 'auth-secret',
    context,
  })
}

async function createTask(values: Partial<typeof tasks.$inferInsert>) {
  return firstOrThrow(
    await db
      .insert(tasks)
      .values({ title: 'Reminder task', ...values })
      .returning(),
  )
}

function sentNotifications() {
  return vi
    .mocked(sendNotification)
    .mock.calls.map(([subscription, payload]) => ({
      endpoint: subscription.endpoint,
      payload: JSON.parse(String(payload)) as unknown,
    }))
}

async function deliveryOutcome() {
  return {
    notifications: sentNotifications(),
    remindAt: await remindAtByTitle(),
  }
}

async function remindAtByTitle() {
  const rows = await db
    .select({ title: tasks.title, remindAt: tasks.remindAt })
    .from(tasks)
    .orderBy(asc(tasks.title))

  return Object.fromEntries(
    rows.map((row) => [row.title, row.remindAt?.toISOString() ?? null]),
  )
}

describe('deliverDueReminders', () => {
  it('notifies the task context only, and clears every reminder it will not deliver', async () => {
    await register(WORK_ENDPOINT, 'work')
    await register(PERSONAL_ENDPOINT, 'personal')

    const now = Date.now()
    const future = new Date(now + HOUR_MS)
    const task = await createTask({
      title: 'Prepare the standup notes',
      context: 'work',
      remindAt: new Date(now - MINUTE_MS),
    })
    await createTask({
      title: 'Missed while the API was down',
      remindAt: new Date(now - 2 * HOUR_MS),
    })
    await createTask({
      title: 'Already finished',
      status: 'completed',
      remindAt: new Date(now - MINUTE_MS),
    })
    await createTask({ title: 'Still upcoming', remindAt: future })
    await createTask({ title: 'Never reminded' })

    await deliverDueReminders()

    expect(await deliveryOutcome()).toEqual({
      notifications: [
        {
          endpoint: WORK_ENDPOINT,
          payload: {
            title: 'Prepare the standup notes',
            body: `#${String(task.number)}`,
            taskId: task.id,
            url: `https://localhost:5173/tasks/${task.id}`,
          },
        },
      ],
      remindAt: {
        'Already finished': null,
        'Missed while the API was down': null,
        'Never reminded': null,
        'Prepare the standup notes': null,
        'Still upcoming': future.toISOString(),
      },
    })
  })

  it('notifies a task once even when the poll runs again', async () => {
    await register(PERSONAL_ENDPOINT, 'personal')
    const task = await createTask({ remindAt: new Date(Date.now() - 1000) })

    await deliverDueReminders()
    await deliverDueReminders()

    expect(sentNotifications()).toEqual([
      {
        endpoint: PERSONAL_ENDPOINT,
        payload: {
          title: 'Reminder task',
          body: `#${String(task.number)}`,
          taskId: task.id,
          url: `https://localhost:5173/tasks/${task.id}`,
        },
      },
    ])
  })
})

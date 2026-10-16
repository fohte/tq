import { asc } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotification } from 'web-push'

import { db } from '#db/connection'
import {
  pushSubscriptions,
  scheduleOverrides,
  scheduleReminderDeliveries,
} from '#db/schema'
import {
  createScheduleSeries,
  updateScheduleSeries,
} from '#routes/schedule-revisions'
import { deliverDueScheduleReminders } from '#services/schedule-reminder-delivery'
import { setupTestDb } from '#testing'

vi.mock('web-push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('web-push')>()
  const mockedSendNotification = vi.fn()
  return {
    ...actual,
    sendNotification: mockedSendNotification,
    default: { ...actual, sendNotification: mockedSendNotification },
  }
})

setupTestDb()

beforeEach(() => {
  vi.mocked(sendNotification).mockReset().mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const WORK_ENDPOINT = 'https://push.example.com/work-device'
const PERSONAL_ENDPOINT = 'https://push.example.com/personal-device'
const REMINDER_TIME = new Date('2026-12-17T04:45:00.000Z')

async function register(endpoint: string, context: 'work' | 'personal') {
  await db.insert(pushSubscriptions).values({
    endpoint,
    p256dh: 'p256dh-key',
    auth: 'auth-secret',
    context,
  })
}

async function createSchedule(
  overrides: Partial<{
    startDate: string
    startTime: string
    endTime: string
    remindBeforeMinutes: number | null
    context: 'work' | 'personal'
    recurrence: {
      type: 'daily' | 'weekly' | 'monthly' | 'custom'
      interval: number
      daysOfWeek?: number[]
      dayOfMonth?: number
    }
  }> = {},
) {
  return createScheduleSeries({
    title: 'Planning session',
    startDate: '2026-12-17',
    startTime: '14:30',
    endTime: '15:30',
    remindBeforeMinutes: 45,
    ...overrides,
  })
}

function sentNotifications() {
  return vi
    .mocked(sendNotification)
    .mock.calls.map(([subscription, payload]) => ({
      endpoint: subscription.endpoint,
      payload: JSON.parse(String(payload)) as unknown,
    }))
}

async function deliveryClaims() {
  const rows = await db
    .select({
      occurrenceDate: scheduleReminderDeliveries.occurrenceDate,
      remindAt: scheduleReminderDeliveries.remindAt,
    })
    .from(scheduleReminderDeliveries)
    .orderBy(asc(scheduleReminderDeliveries.remindAt))

  return rows.map(({ occurrenceDate, remindAt }) => ({
    scheduleId: 'SCHEDULE_ID',
    occurrenceDate,
    remindAt: remindAt.toISOString(),
  }))
}

async function reminderSnapshot() {
  return {
    notifications: sentNotifications(),
    claims: await deliveryClaims(),
  }
}

describe('deliverDueScheduleReminders', () => {
  it('sends a due reminder once to the schedule context', async () => {
    await register(WORK_ENDPOINT, 'work')
    await register(PERSONAL_ENDPOINT, 'personal')
    await createSchedule({ context: 'work' })

    await deliverDueScheduleReminders(REMINDER_TIME)
    await deliverDueScheduleReminders(REMINDER_TIME)

    expect(await reminderSnapshot()).toEqual({
      notifications: [
        {
          endpoint: WORK_ENDPOINT,
          payload: {
            title: 'Planning session',
            body: 'Starts in 45 minutes',
            url: 'https://localhost:5173/',
          },
        },
      ],
      claims: [
        {
          scheduleId: 'SCHEDULE_ID',
          occurrenceDate: '2026-12-17',
          remindAt: REMINDER_TIME.toISOString(),
        },
      ],
    })
  })

  it('sends a moved occurrence at the destination time only', async () => {
    await register(PERSONAL_ENDPOINT, 'personal')
    const series = await createSchedule()
    await db.insert(scheduleOverrides).values({
      scheduleId: series.schedule.id,
      occurrenceDate: '2026-12-17',
      startTime: '14:30',
      endTime: '15:30',
      movedToDate: '2026-12-18',
    })

    await deliverDueScheduleReminders(REMINDER_TIME)
    await deliverDueScheduleReminders(new Date('2026-12-18T04:45:00.000Z'))

    expect(await reminderSnapshot()).toEqual({
      notifications: [
        {
          endpoint: PERSONAL_ENDPOINT,
          payload: {
            title: 'Planning session',
            body: 'Starts in 45 minutes',
            url: 'https://localhost:5173/',
          },
        },
      ],
      claims: [
        {
          scheduleId: 'SCHEDULE_ID',
          occurrenceDate: '2026-12-17',
          remindAt: '2026-12-18T04:45:00.000Z',
        },
      ],
    })
  })

  it('does not claim or send a cancelled occurrence', async () => {
    await register(PERSONAL_ENDPOINT, 'personal')
    const series = await createSchedule()
    await db.insert(scheduleOverrides).values({
      scheduleId: series.schedule.id,
      occurrenceDate: '2026-12-17',
      startTime: null,
      endTime: null,
      skipped: true,
    })

    await deliverDueScheduleReminders(REMINDER_TIME)

    expect(await reminderSnapshot()).toEqual({ notifications: [], claims: [] })
  })

  it('uses the active revision time for a changed occurrence', async () => {
    await register(PERSONAL_ENDPOINT, 'personal')
    const series = await createSchedule({
      recurrence: { type: 'daily', interval: 1 },
    })
    await updateScheduleSeries(series.schedule.id, {
      effectiveFrom: '2026-12-17',
      startTime: '15:00',
      endTime: '15:30',
    })

    await deliverDueScheduleReminders(new Date('2026-12-17T05:15:00.000Z'))
    await deliverDueScheduleReminders(new Date('2026-12-17T05:16:00.000Z'))

    expect(await reminderSnapshot()).toEqual({
      notifications: [
        {
          endpoint: PERSONAL_ENDPOINT,
          payload: {
            title: 'Planning session',
            body: 'Starts in 45 minutes',
            url: 'https://localhost:5173/',
          },
        },
      ],
      claims: [
        {
          scheduleId: 'SCHEDULE_ID',
          occurrenceDate: '2026-12-17',
          remindAt: '2026-12-17T05:15:00.000Z',
        },
      ],
    })
  })
})

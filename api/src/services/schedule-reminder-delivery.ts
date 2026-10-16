import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { lt } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { scheduleReminderDeliveries } from '#db/schema'
import { APP_DOMAIN, SCHEDULE_REMINDER_TIME_ZONE } from '#env'
import { addCalendarDays, formatDateInTimeZone } from '#lib/timezone'
import {
  loadScheduleOverridesForExpansion,
  loadSchedulesWithRules,
} from '#routes/schedule-shared'
import { sendPush } from '#services/push'
import { collectDueScheduleReminders } from '#services/schedule-reminder-candidates'

const DELIVERY_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

function reminderKey(reminder: {
  scheduleId: string
  occurrenceDate: string
  remindAt: Date
}): string {
  return `${reminder.scheduleId}:${reminder.occurrenceDate}:${reminder.remindAt.toISOString()}`
}

/** Claim and send reminders for schedule occurrences starting today or tomorrow. */
export async function deliverDueScheduleReminders(
  now = new Date(),
  timeZone = SCHEDULE_REMINDER_TIME_ZONE,
): Promise<void> {
  await db
    .delete(scheduleReminderDeliveries)
    .where(
      lt(
        scheduleReminderDeliveries.deliveredAt,
        new Date(now.getTime() - DELIVERY_RETENTION_MS),
      ),
    )

  const today = formatDateInTimeZone(now, timeZone)
  const tomorrow = addCalendarDays(today, 1)
  const dates = [today, tomorrow]
  const series = await loadSchedulesWithRules()
  const overridesBySchedule = await loadScheduleOverridesForExpansion(
    today,
    tomorrow,
  )
  const candidates = collectDueScheduleReminders(
    series,
    overridesBySchedule,
    dates,
    now,
    timeZone,
  )

  if (candidates.length === 0) return

  const candidateByKey = new Map(
    candidates.map((candidate) => [reminderKey(candidate), candidate]),
  )
  const claimed = await db
    .insert(scheduleReminderDeliveries)
    .values(
      candidates.map(({ scheduleId, occurrenceDate, remindAt }) => ({
        scheduleId,
        occurrenceDate,
        remindAt,
      })),
    )
    .onConflictDoNothing()
    .returning({
      scheduleId: scheduleReminderDeliveries.scheduleId,
      occurrenceDate: scheduleReminderDeliveries.occurrenceDate,
      remindAt: scheduleReminderDeliveries.remindAt,
    })

  for (const claim of claimed) {
    const reminder = candidateByKey.get(reminderKey(claim))
    if (!reminder) continue
    const minutesUntilStart = Math.ceil(
      (reminder.startsAt.getTime() - now.getTime()) / 60_000,
    )

    const sent = await ResultAsync.fromPromise(
      sendPush(
        { context: reminder.context },
        {
          title: reminder.title,
          body:
            minutesUntilStart <= 0
              ? 'Starts now'
              : `Starts in ${String(minutesUntilStart)} minutes`,
          url: `https://${APP_DOMAIN}/`,
        },
      ),
      toError,
    )
    if (sent.isErr()) {
      captureWithFingerprint(sent.error, 'api.schedule-reminders.send-failed', {
        extras: {
          scheduleId: reminder.scheduleId,
          occurrenceDate: reminder.occurrenceDate,
        },
      })
    }
  }
}

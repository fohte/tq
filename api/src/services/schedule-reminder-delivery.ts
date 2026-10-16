import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { lt } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { scheduleReminderDeliveries } from '#db/schema'
import { APP_DOMAIN, SCHEDULE_REMINDER_TIME_ZONE } from '#env'
import {
  addCalendarDays,
  formatDateInTimeZone,
  localDateTimeToUtc,
} from '#lib/timezone'
import { getScheduleOccurrencesStartingOnDate } from '#routes/schedule-expansion'
import {
  loadScheduleOverridesForExpansion,
  loadSchedulesWithRules,
} from '#routes/schedule-shared'
import { sendPush } from '#services/push'

const MAX_LATENESS_MS = 60 * 60 * 1000
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
  const series = (await loadSchedulesWithRules()).filter(
    ({ schedule }) => schedule.remindBeforeMinutes !== null,
  )
  const overridesBySchedule = await loadScheduleOverridesForExpansion(
    today,
    tomorrow,
  )

  const candidates = series.flatMap(({ schedule, ...scheduleSeries }) => {
    const remindBeforeMinutes = schedule.remindBeforeMinutes
    if (remindBeforeMinutes === null) return []

    return dates.flatMap((date) =>
      getScheduleOccurrencesStartingOnDate(
        { schedule, ...scheduleSeries },
        date,
        overridesBySchedule.get(schedule.id),
      ).flatMap((occurrence) => {
        const startsAt = localDateTimeToUtc(
          date,
          occurrence.startTime,
          timeZone,
        )
        const remindAt = new Date(
          startsAt.getTime() - remindBeforeMinutes * 60_000,
        )
        if (
          remindAt > now ||
          remindAt <= new Date(now.getTime() - MAX_LATENESS_MS)
        ) {
          return []
        }

        return [
          {
            scheduleId: schedule.id,
            occurrenceDate: occurrence.occurrenceDate,
            remindAt,
            title: schedule.title,
            context: schedule.context,
            remindBeforeMinutes,
          },
        ]
      }),
    )
  })

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

    const sent = await ResultAsync.fromPromise(
      sendPush(
        { context: reminder.context },
        {
          title: reminder.title,
          body:
            reminder.remindBeforeMinutes === 0
              ? 'Starts now'
              : `Starts in ${String(reminder.remindBeforeMinutes)} minutes`,
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

import { localDateTimeToUtc } from '#lib/timezone'
import {
  getScheduleOccurrencesStartingOnDate,
  type ScheduleOverrideIndex,
  type ScheduleSeries,
} from '#routes/schedule-expansion'

const MAX_LATENESS_MS = 60 * 60 * 1000
const ZERO_MINUTE_START_GRACE_MS = 60 * 1000

type ScheduleReminderCandidate = {
  scheduleId: string
  occurrenceDate: string
  remindAt: Date
  startsAt: Date
  title: string
  context: ScheduleSeries['schedule']['context']
}

export function collectDueScheduleReminders(
  series: readonly ScheduleSeries[],
  overridesBySchedule: ReadonlyMap<string, ScheduleOverrideIndex>,
  dates: readonly string[],
  now: Date,
  timeZone: string,
): ScheduleReminderCandidate[] {
  const nowMs = now.getTime()
  const latestAcceptableRemindAtMs = nowMs - MAX_LATENESS_MS

  return series.flatMap(({ schedule, ...scheduleSeries }) => {
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
        const startsInMs = startsAt.getTime() - nowMs
        const isWithinZeroMinuteGrace =
          remindBeforeMinutes === 0 && startsInMs >= -ZERO_MINUTE_START_GRACE_MS

        if (
          remindAt.getTime() > nowMs ||
          remindAt.getTime() <= latestAcceptableRemindAtMs ||
          (startsInMs < 0 && !isWithinZeroMinuteGrace)
        ) {
          return []
        }

        return [
          {
            scheduleId: schedule.id,
            occurrenceDate: occurrence.occurrenceDate,
            remindAt,
            startsAt,
            title: schedule.title,
            context: schedule.context,
          },
        ]
      }),
    )
  })
}

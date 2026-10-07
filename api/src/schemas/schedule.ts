import { z } from 'zod'

export const MAX_SCHEDULE_DATE_RANGE_DAYS = 42
export const SCHEDULE_DATE_RANGE_ERROR_MESSAGE = `Date range must be chronological and no longer than ${String(MAX_SCHEDULE_DATE_RANGE_DAYS)} days`

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000

export const scheduleDateRangeInputSchema = z.object({
  startDate: z.iso
    .date()
    .describe('First local date to include, as YYYY-MM-DD.'),
  endDate: z.iso.date().describe('Last local date to include, as YYYY-MM-DD.'),
})

export function isScheduleDateRangeValid({
  startDate,
  endDate,
}: {
  startDate: string
  endDate: string
}): boolean {
  const rangeMilliseconds =
    Date.parse(`${endDate}T00:00:00.000Z`) -
    Date.parse(`${startDate}T00:00:00.000Z`)
  return (
    rangeMilliseconds >= 0 &&
    rangeMilliseconds < MAX_SCHEDULE_DATE_RANGE_DAYS * DAY_IN_MILLISECONDS
  )
}

export const scheduleDateRangeSchema = scheduleDateRangeInputSchema.refine(
  isScheduleDateRangeValid,
  { message: SCHEDULE_DATE_RANGE_ERROR_MESSAGE, path: ['endDate'] },
)

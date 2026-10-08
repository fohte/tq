import { z } from 'zod'

const TIMEZONE_OFFSET_DESCRIPTION =
  'Timezone offset in minutes using the Date.getTimezoneOffset() convention (UTC minus local).'

export const timezoneOffsetMinutesSchema = z
  .number()
  .int()
  .min(-840)
  .max(720)
  .describe(TIMEZONE_OFFSET_DESCRIPTION)

export const queryTimezoneOffsetMinutesSchema = z.coerce
  .number()
  .int()
  .min(-840)
  .max(720)
  .describe(TIMEZONE_OFFSET_DESCRIPTION)

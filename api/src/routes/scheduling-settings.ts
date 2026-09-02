import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { z } from 'zod'

import type { SchedulingSettings } from '#services/scheduling-settings'
import {
  getSchedulingSettings,
  updateSchedulingSettings,
} from '#services/scheduling-settings'

// Matches api/src/routes/schedules.ts's local timePattern const.
const timePattern = /^\d{2}:\d{2}$/

const updateSchedulingSettingsSchema = z
  .object({
    workingHoursStart: z.string().regex(timePattern).optional(),
    workingHoursEnd: z.string().regex(timePattern).optional(),
    minimumBlockMinutes: z.number().int().positive().optional(),
    autoRescheduleOnGcalChange: z.boolean().optional(),
  })
  .refine(
    (input) =>
      (input.workingHoursStart === undefined) ===
      (input.workingHoursEnd === undefined),
    { message: 'workingHoursStart and workingHoursEnd must be set together' },
  )
  .refine(
    (input) =>
      input.workingHoursStart === undefined ||
      input.workingHoursEnd === undefined ||
      input.workingHoursStart < input.workingHoursEnd,
    { message: 'workingHoursStart must be before workingHoursEnd' },
  )

function toResponse(row: SchedulingSettings) {
  return {
    workingHoursStart: row.workingHoursStart,
    workingHoursEnd: row.workingHoursEnd,
    minimumBlockMinutes: row.minimumBlockMinutes,
    autoRescheduleOnGcalChange: row.autoRescheduleOnGcalChange,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const schedulingSettingsApp = new Hono()
  .get('/', async (c) => {
    const result = await getSchedulingSettings()
    return result.match(
      (row) => c.json(toResponse(row), 200),
      (error) => {
        captureWithFingerprint(error, 'api.scheduling-settings.get-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })
  .patch('/', zValidator('json', updateSchedulingSettingsSchema), async (c) => {
    const input = c.req.valid('json')
    const result = await updateSchedulingSettings(input)
    return result.match(
      (row) => c.json(toResponse(row), 200),
      (error) => {
        captureWithFingerprint(error, 'api.scheduling-settings.update-failed')
        return c.json({ error: 'Internal server error' }, 500)
      },
    )
  })

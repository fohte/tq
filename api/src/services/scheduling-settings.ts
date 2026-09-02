import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { SCHEDULING_SETTINGS_ID, schedulingSettings } from '#db/schema'
import { firstOrErr, type RowNotFoundError } from '#lib/drizzle-utils'

export type SchedulingSettings = typeof schedulingSettings.$inferSelect

export function getSchedulingSettings(): ResultAsync<
  SchedulingSettings,
  RowNotFoundError
> {
  return ResultAsync.fromSafePromise(
    db
      .select()
      .from(schedulingSettings)
      .where(eq(schedulingSettings.id, SCHEDULING_SETTINGS_ID)),
  ).andThen((rows) => firstOrErr(rows))
}

// Each field is `T | undefined` (not just optional) to match the shape
// zod's `.optional()` produces under `exactOptionalPropertyTypes`.
export interface UpdateSchedulingSettingsInput {
  workingHoursStart?: string | undefined
  workingHoursEnd?: string | undefined
  minimumBlockMinutes?: number | undefined
  autoRescheduleOnGcalChange?: boolean | undefined
}

export function updateSchedulingSettings(
  input: UpdateSchedulingSettingsInput,
): ResultAsync<SchedulingSettings, RowNotFoundError> {
  return ResultAsync.fromSafePromise(
    db
      .update(schedulingSettings)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(schedulingSettings.id, SCHEDULING_SETTINGS_ID))
      .returning(),
  ).andThen((rows) => firstOrErr(rows))
}

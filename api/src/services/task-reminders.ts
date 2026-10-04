import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { ResultAsync } from 'neverthrow'

import { deliverDueReminders } from '#services/reminder-delivery'

// `remind_at` is entered per minute (`<input type="datetime-local">`), so a
// 60s tick would land a 9:00 reminder as late as 9:00:59. Halve this to halve
// the worst-case lateness.
const POLL_INTERVAL_MS = 30_000

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Start polling for due reminders. Called from the server entrypoint rather
 * than from `app.ts` so tests never run the ticker.
 */
export function startReminderScheduler(): NodeJS.Timeout {
  return setInterval(() => {
    void ResultAsync.fromPromise(deliverDueReminders(), toError).match(
      () => undefined,
      (error) => {
        captureWithFingerprint(error, 'api.reminders.tick-failed')
      },
    )
  }, POLL_INTERVAL_MS)
}

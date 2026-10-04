import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { ResultAsync } from 'neverthrow'

import { generateDueRecurringTasks } from '#services/recurring-task-generator'

// A day-level trigger, not a minute-level one: a template's due occurrences
// never change within a day, so this doesn't need task-reminders.ts's
// reminder-grade precision.
const POLL_INTERVAL_MS = 15 * 60 * 1000

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Start polling for due recurring task occurrences. Called from the server
 * entrypoint rather than from `app.ts` so tests never run the ticker.
 */
export function startRecurringTaskScheduler(): NodeJS.Timeout {
  return setInterval(() => {
    void ResultAsync.fromPromise(generateDueRecurringTasks(), toError).match(
      () => undefined,
      (error) => {
        captureWithFingerprint(
          error,
          'api.recurring-task-scheduler.tick-failed',
        )
      },
    )
  }, POLL_INTERVAL_MS)
}

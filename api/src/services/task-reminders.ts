import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, gt, lte, or } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import { sendPush } from '#services/push'

// `remind_at` is entered per minute (`<input type="datetime-local">`), so a
// 60s tick would land a 9:00 reminder as late as 9:00:59. Halve this to halve
// the worst-case lateness.
const POLL_INTERVAL_MS = 30_000

// A reminder whose time passed while the API was down is dropped instead of
// fired late: coming back from an outage must not replay a day of
// notifications at once.
const MAX_LATENESS_MS = 60 * 60 * 1000

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Deliver every reminder that has come due, and retire the ones that are too
 * late or no longer wanted.
 */
export async function deliverDueReminders(): Promise<void> {
  // One `now` for both statements: a second read of the clock would let a
  // reminder that came due in between be swept away without being sent.
  const now = new Date()

  // Claiming with `UPDATE ... RETURNING` hands each reminder to exactly one
  // API process, which a rolling deploy briefly runs two of.
  const due = await db
    .update(tasks)
    .set({ remindAt: null })
    .where(
      and(
        lte(tasks.remindAt, now),
        gt(tasks.remindAt, new Date(now.getTime() - MAX_LATENESS_MS)),
        eq(tasks.status, 'todo'),
      ),
    )
    .returning({
      id: tasks.id,
      number: tasks.number,
      title: tasks.title,
      context: tasks.context,
    })

  // The rest still has to lose its `remind_at`, otherwise every later tick
  // reconsiders it forever. Restated rather than inverted with `not()` so a
  // reminder set to a past instant between the two statements stays for the
  // next tick instead of being retired here without ever being sent.
  await db
    .update(tasks)
    .set({ remindAt: null })
    .where(
      and(
        lte(tasks.remindAt, now),
        or(
          lte(tasks.remindAt, new Date(now.getTime() - MAX_LATENESS_MS)),
          eq(tasks.status, 'completed'),
        ),
      ),
    )

  for (const task of due) {
    // Isolated per task: `remind_at` is already cleared, so letting one
    // failure abort the loop would lose every remaining reminder for good.
    const sent = await ResultAsync.fromPromise(
      sendPush(
        { context: task.context },
        {
          title: task.title,
          body: `#${String(task.number)}`,
          taskId: task.id,
          url: `https://${APP_DOMAIN}/tasks/${task.id}`,
        },
      ),
      toError,
    )
    if (sent.isErr()) {
      captureWithFingerprint(sent.error, 'api.reminders.send-failed', {
        extras: { taskId: task.id },
      })
    }
  }
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

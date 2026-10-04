import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { ResultAsync } from 'neverthrow'

import { syncDueGithubLinks } from '#services/github-sync'

const POLL_INTERVAL_MS = 60 * 60 * 1000

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/**
 * Start hourly polling for due GitHub links. Called from the server entrypoint
 * rather than app.ts so tests never run the ticker.
 */
export function startGithubLinkWatchScheduler(): NodeJS.Timeout {
  return setInterval(() => {
    void ResultAsync.fromPromise(syncDueGithubLinks(), toError).match(
      () => undefined,
      (error) => {
        captureWithFingerprint(
          error,
          'api.github-link-watch-scheduler.tick-failed',
        )
      },
    )
  }, POLL_INTERVAL_MS)
}

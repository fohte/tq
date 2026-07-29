import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import { fetchGithubIssue } from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { recordEdit, SYSTEM_AUTHOR } from '#lib/edits'

const POLL_INTERVAL_MS = 60_000

type LinkRow = typeof taskGithubLinks.$inferSelect

type SyncLinkError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError

// `link.title`/`link.body`/`link.state` hold the GitHub values as of the
// last poll (see schema.ts), so diffing a fresh fetch against them tells
// "GitHub changed" apart from "the task was edited in TQ" — only the former
// should overwrite the task.
export function syncLinkFromGithub(
  link: LinkRow,
): ResultAsync<void, SyncLinkError> {
  return fetchGithubIssue({
    owner: link.owner,
    repo: link.repo,
    number: link.number,
  }).andThen((issue) => {
    const titleChanged = issue.title !== link.title
    const bodyChanged = issue.body !== link.body
    const stateChanged = issue.state !== link.state
    const now = new Date()

    if (!titleChanged && !bodyChanged && !stateChanged) {
      return ResultAsync.fromSafePromise(
        db
          .update(taskGithubLinks)
          .set({ lastSyncedAt: now })
          .where(eq(taskGithubLinks.id, link.id)),
      ).map(() => undefined)
    }

    return ResultAsync.fromSafePromise(
      db.transaction(async (tx) => {
        if (titleChanged || bodyChanged) {
          await tx
            .update(tasks)
            .set({
              ...(titleChanged ? { title: issue.title } : {}),
              ...(bodyChanged ? { description: issue.body } : {}),
              updatedAt: now,
            })
            .where(eq(tasks.id, link.taskId))

          if (titleChanged) {
            await recordEdit(
              tx,
              { taskId: link.taskId },
              { action: 'update', field: 'title' },
              SYSTEM_AUTHOR,
            )
          }
          if (bodyChanged) {
            await recordEdit(
              tx,
              { taskId: link.taskId },
              { action: 'update', field: 'description' },
              SYSTEM_AUTHOR,
            )
          }
        }

        await tx
          .update(taskGithubLinks)
          .set({
            title: issue.title,
            body: issue.body,
            state: issue.state,
            lastSyncedAt: now,
          })
          .where(eq(taskGithubLinks.id, link.id))
      }),
    ).map(() => undefined)
  })
}

// A rejected GithubApiError (4xx: e.g. the token lost access, or the
// issue/PR is gone) and a missing/unusable token are both normal "not
// currently syncable" states, not operational failures — skip them quietly
// so a disconnected or revoked GitHub integration doesn't spam error
// reporting every poll. Anything else (network/parse/5xx) is unexpected and
// must be captured.
function isQuietSyncError(error: SyncLinkError): boolean {
  if (error instanceof GithubApiError) {
    return error.rejected
  }
  return true
}

export async function syncAllGithubLinks(): Promise<void> {
  const tokenResult = await getValidAccessToken(githubProvider)
  if (tokenResult.isErr()) {
    return
  }

  const links = await db.select().from(taskGithubLinks)

  for (const link of links) {
    const result = await syncLinkFromGithub(link)
    if (result.isErr() && !isQuietSyncError(result.error)) {
      captureWithFingerprint(result.error, 'api.github-sync.sync-link-failed', {
        extras: { linkId: link.id },
      })
    }
  }
}

export function startGithubSyncPolling(): void {
  let isSyncing = false

  const tick = () => {
    if (isSyncing) return
    isSyncing = true
    void syncAllGithubLinks()
      .catch((error: unknown) => {
        captureWithFingerprint(error, 'api.github-sync.poll-failed')
      })
      .finally(() => {
        isSyncing = false
      })
  }

  tick()
  setInterval(tick, POLL_INTERVAL_MS)
}

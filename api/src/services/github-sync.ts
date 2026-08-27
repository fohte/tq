import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import { fetchGithubIssueIfChanged } from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { isQuietProviderError } from '#integrations/quiet-errors'
import { recordEdit, SYSTEM_AUTHOR } from '#lib/edits'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'

type LinkRow = typeof taskGithubLinks.$inferSelect

type SyncLinkError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError

// `link.title`/`link.body`/`link.state` hold the GitHub values as of the
// last sync (see db/schema/integrations.ts), so diffing a fresh fetch
// against them tells "GitHub changed" apart from "the task was edited in
// TQ" — only the former should overwrite the task.
export function syncLinkFromGithub(
  link: LinkRow,
): ResultAsync<void, SyncLinkError> {
  return fetchGithubIssueIfChanged(
    { owner: link.owner, repo: link.repo, number: link.number },
    link.etag,
  ).andThen((result) => {
    const now = new Date()

    if (result.notModified) {
      // GitHub confirmed nothing changed since the stored etag (a bare 304,
      // no primary-rate-limit cost) — nothing to diff or write beyond the
      // check itself.
      return ResultAsync.fromSafePromise(
        db
          .update(taskGithubLinks)
          .set({ lastSyncedAt: now })
          .where(eq(taskGithubLinks.id, link.id)),
      ).map(() => undefined)
    }

    const { issue, etag } = result

    // `lastSyncedAt` defaults to the same insert-time value as `createdAt`
    // and only diverges once a sync actually runs, so equality also means
    // "never synced" — true for a link created moments ago, and for a
    // pre-existing link from before this column existed (its stored
    // title/body/state can't be trusted as a real baseline). Either way,
    // the right move is to seed the snapshot, not diff it. `etag` starting
    // out null guarantees this fetch was unconditional (never a 304), so
    // this case and the one above are mutually exclusive.
    const isFirstSync = link.lastSyncedAt.getTime() === link.createdAt.getTime()
    const titleChanged = !isFirstSync && issue.title !== link.title
    const bodyChanged = !isFirstSync && issue.body !== link.body
    const stateChanged = !isFirstSync && issue.state !== link.state

    if (!titleChanged && !bodyChanged && !stateChanged) {
      return ResultAsync.fromSafePromise(
        db
          .update(taskGithubLinks)
          .set({
            title: issue.title,
            body: issue.body,
            state: issue.state,
            etag,
            lastSyncedAt: now,
          })
          .where(eq(taskGithubLinks.id, link.id)),
      ).map(() => undefined)
    }

    // Unlike the task PATCH route, task-link recomputation (see
    // `#services/task-links`) is skipped here: GitHub issue/PR numbers
    // (`#76`) live in GitHub's own numbering space, not tq's task numbers, so
    // scanning a GitHub-sourced body for `#<number>` mentions would link
    // unrelated tq tasks together.
    return ResultAsync.fromSafePromise(
      db.transaction(async (tx) => {
        if (titleChanged || bodyChanged) {
          const updated = await tx
            .update(tasks)
            .set({
              ...(titleChanged ? { title: issue.title } : {}),
              ...(bodyChanged ? { description: issue.body } : {}),
              updatedAt: now,
            })
            .where(eq(tasks.id, link.taskId))
            .returning({ id: tasks.id })

          // The task may have been deleted concurrently between the
          // sync's link lookup and this write; its link row
          // cascade-deletes with it, so there's nothing left to sync
          // (mirrors syncTaskLinks' own guard for the same race).
          if (updated.length === 0) return

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
            etag,
            lastSyncedAt: now,
          })
          .where(eq(taskGithubLinks.id, link.id))
      }),
    ).map(() => undefined)
  })
}

async function runSync(): Promise<void> {
  const tokenResult = await getValidAccessToken(githubProvider)
  if (tokenResult.isErr()) {
    if (!isQuietProviderError(tokenResult.error)) {
      captureWithFingerprint(
        tokenResult.error,
        'api.github-sync.get-token-failed',
      )
    }
    return
  }

  const links = await db.select().from(taskGithubLinks)

  for (const link of links) {
    const result = await syncLinkFromGithub(link)
    if (result.isErr() && !isQuietProviderError(result.error)) {
      captureWithFingerprint(result.error, 'api.github-sync.sync-link-failed', {
        extras: { linkId: link.id },
      })
    }
  }

  await syncGithubAssignedIssues()
}

let inFlightSync: Promise<void> | null = null

// Syncs every linked task. Triggered by the web client (see
// routes/github.ts's POST /sync) while it's open and focused — there is no
// server-side background schedule. A client with multiple tabs open
// triggers this concurrently from each one; coalescing into a single
// in-flight pass keeps that from multiplying the GitHub requests and DB
// scans by tab count.
export function syncAllGithubLinks(): Promise<void> {
  inFlightSync ??= runSync().finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { eq } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks } from '#db/schema'
import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import { fetchGithubIssueIfChanged } from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { isQuietProviderError } from '#integrations/quiet-errors'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'

type LinkRow = typeof taskGithubLinks.$inferSelect

type SyncLinkError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError

// Writes only to this row — GitHub content never reaches `tasks`.
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
      // no primary-rate-limit cost) — nothing to write beyond the check
      // itself.
      return ResultAsync.fromSafePromise(
        db
          .update(taskGithubLinks)
          .set({ lastSyncedAt: now })
          .where(eq(taskGithubLinks.id, link.id)),
      ).map(() => undefined)
    }

    const { issue, etag } = result

    return ResultAsync.fromSafePromise(
      db
        .update(taskGithubLinks)
        .set({
          title: issue.title,
          state: issue.state,
          etag,
          lastSyncedAt: now,
        })
        .where(eq(taskGithubLinks.id, link.id)),
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

import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, lt, ne, or } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import {
  fetchGithubIssueIfChanged,
  type GithubIssueData,
} from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { isQuietProviderError } from '#integrations/quiet-errors'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'
import { sendPush } from '#services/push'

type LinkRow = typeof taskGithubLinks.$inferSelect

type SyncLinkError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | GithubLinkSyncError

class GithubLinkSyncError extends Error {
  constructor(error: unknown) {
    super('Failed to notify about a GitHub link change', { cause: error })
    this.name = 'GithubLinkSyncError'
  }
}

const SUBJECT_SYNC_INTERVAL_MS = 60 * 60 * 1000
const BLOCKER_SYNC_INTERVAL_MS = 24 * SUBJECT_SYNC_INTERVAL_MS

function changedEvent(
  link: LinkRow,
  issue: GithubIssueData,
): { event: LinkRow['notifyEvents'][number]; title: string } | null {
  const ref = `${link.owner}/${link.repo}#${String(link.number)}`

  if (link.state === 'open' && issue.state !== 'open') {
    const title =
      issue.state === 'merged'
        ? `${ref} was merged`
        : issue.kind === 'pull_request'
          ? `${ref} was closed without merging`
          : issue.stateReason === 'not_planned'
            ? `${ref} was closed as not planned`
            : `${ref} was closed`
    return { event: 'closed', title }
  }

  if (link.state !== 'open' && issue.state === 'open') {
    return { event: 'reopened', title: `${ref} was reopened` }
  }

  if (link.commentsCount !== null && issue.commentsCount > link.commentsCount) {
    const newComments = issue.commentsCount - link.commentsCount
    return {
      event: 'comments',
      title: `${ref}: ${String(newComments)} new ${
        newComments === 1 ? 'comment' : 'comments'
      }`,
    }
  }

  if (
    link.githubUpdatedAt !== null &&
    new Date(issue.githubUpdatedAt).getTime() !== link.githubUpdatedAt.getTime()
  ) {
    return { event: 'other', title: `${ref} has new activity` }
  }

  return null
}

function toError(error: unknown): GithubLinkSyncError {
  return new GithubLinkSyncError(error)
}

// Caches GitHub fields on the link and leaves the task itself untouched.
export function syncLinkFromGithub(
  link: LinkRow,
): ResultAsync<void, SyncLinkError> {
  if (link.state === 'merged') {
    return okAsync(undefined)
  }

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
    const notification = changedEvent(link, issue)

    return ResultAsync.fromSafePromise(
      db
        .update(taskGithubLinks)
        .set({
          title: issue.title,
          state: issue.state,
          commentsCount: issue.commentsCount,
          githubUpdatedAt: new Date(issue.githubUpdatedAt),
          stateReason: issue.stateReason,
          etag,
          lastSyncedAt: now,
        })
        .where(eq(taskGithubLinks.id, link.id)),
    )
      .map(() => undefined)
      .andThen(() => {
        if (
          notification === null ||
          !link.notifyEvents.includes(notification.event)
        ) {
          return okAsync(undefined)
        }

        return ResultAsync.fromPromise(
          db
            .select({
              id: tasks.id,
              number: tasks.number,
              title: tasks.title,
              status: tasks.status,
              context: tasks.context,
            })
            .from(tasks)
            .where(eq(tasks.id, link.taskId))
            .then((rows) => rows[0]),
          toError,
        ).andThen((task) => {
          if (task == null || task.status !== 'todo') {
            return okAsync(undefined)
          }

          return ResultAsync.fromPromise(
            sendPush(
              { context: task.context },
              {
                title: notification.title,
                body: `#${String(task.number)} ${task.title}`,
                taskId: task.id,
                url: `https://${APP_DOMAIN}/tasks/${task.id}`,
              },
            ),
            toError,
          ).map(() => undefined)
        })
      })
  })
}

async function hasGithubAccess(): Promise<boolean> {
  const tokenResult = await getValidAccessToken(githubProvider)
  if (tokenResult.isErr()) {
    if (!isQuietProviderError(tokenResult.error)) {
      captureWithFingerprint(
        tokenResult.error,
        'api.github-sync.get-token-failed',
      )
    }
    return false
  }

  return true
}

async function syncLinks(links: LinkRow[]): Promise<void> {
  for (const link of links) {
    const result = await syncLinkFromGithub(link)
    if (result.isErr() && !isQuietProviderError(result.error)) {
      captureWithFingerprint(result.error, 'api.github-sync.sync-link-failed', {
        extras: { linkId: link.id },
      })
    }
  }
}

async function runSync(): Promise<void> {
  if (!(await hasGithubAccess())) {
    return
  }

  const links = await db.select().from(taskGithubLinks)
  await syncLinks(links)

  await syncGithubAssignedIssues()
}

export async function syncDueGithubLinks(): Promise<void> {
  const now = new Date()
  const subjectCutoff = new Date(now.getTime() - SUBJECT_SYNC_INTERVAL_MS)
  const blockerCutoff = new Date(now.getTime() - BLOCKER_SYNC_INTERVAL_MS)
  const links = await db
    .select()
    .from(taskGithubLinks)
    .where(
      and(
        ne(taskGithubLinks.state, 'merged'),
        or(
          and(
            eq(taskGithubLinks.role, 'subject'),
            lt(taskGithubLinks.lastSyncedAt, subjectCutoff),
          ),
          and(
            eq(taskGithubLinks.role, 'blocker'),
            lt(taskGithubLinks.lastSyncedAt, blockerCutoff),
          ),
        ),
      ),
    )

  if (links.length === 0 || !(await hasGithubAccess())) {
    return
  }

  await syncLinks(links)
}

let inFlightSync: Promise<void> | null = null

// The client-triggered pass refreshes links while the app is open; the
// server-side scheduler also checks links when no client is active.
export function syncAllGithubLinks(): Promise<void> {
  inFlightSync ??= runSync().finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

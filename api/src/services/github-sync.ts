import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, inArray, isNull } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, taskWaits } from '#db/schema'
import { githubProvider } from '#integrations/github/index'
import { fetchGithubIssueIfChanged } from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { isQuietProviderError } from '#integrations/quiet-errors'
import { publishChangeEvent } from '#lib/change-events'
import {
  findUnresolvedWait,
  syncChangedIssue,
  type SyncLinkError,
  updateUnchangedLink,
} from '#services/github-sync-issue'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'
import {
  syncSubjectWaitIfNeeded,
  type UnresolvedWait,
} from '#services/github-sync-subject-waits'

type LinkRow = typeof taskGithubLinks.$inferSelect

// Store the pass start so network latency does not shorten the next scheduler interval.
export function syncLinkFromGithub(
  link: LinkRow,
  syncStartedAt = new Date(),
  onWrite?: (taskId: string) => void,
  unresolvedWait?: UnresolvedWait | null,
): ResultAsync<void, SyncLinkError> {
  const mayHaveSubjectWait =
    link.role === 'subject' && link.kind === 'pull_request'
  if (link.state === 'merged' && !mayHaveSubjectWait) {
    return okAsync(undefined)
  }

  const lastSyncedAt =
    syncStartedAt.getTime() < link.lastSyncedAt.getTime()
      ? link.lastSyncedAt
      : syncStartedAt

  const subjectWaitActivityResult = mayHaveSubjectWait
    ? syncSubjectWaitIfNeeded(
        link,
        unresolvedWait != null
          ? okAsync(unresolvedWait)
          : findUnresolvedWait(link.id),
        onWrite,
      )
    : okAsync(null)

  return subjectWaitActivityResult.andThen((subjectWaitActivity) => {
    if (link.state === 'merged') {
      return okAsync(undefined)
    }

    return fetchGithubIssueIfChanged(
      { owner: link.owner, repo: link.repo, number: link.number },
      link.etag,
    ).andThen((result) => {
      if (result.notModified) {
        return updateUnchangedLink(link, lastSyncedAt)
      }

      if (mayHaveSubjectWait) {
        return syncChangedIssue(
          link,
          result.issue,
          result.etag,
          lastSyncedAt,
          null,
          onWrite,
          subjectWaitActivity,
        )
      }

      // A wait can be created after the batch prefetch while this fetch runs.
      const activeWaitResult =
        unresolvedWait != null
          ? okAsync(unresolvedWait)
          : findUnresolvedWait(link.id)

      return activeWaitResult.andThen((activeWait) =>
        syncChangedIssue(
          link,
          result.issue,
          result.etag,
          lastSyncedAt,
          activeWait,
          onWrite,
        ),
      )
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

async function syncLinks(
  links: LinkRow[],
  onWrite?: (taskId: string) => void,
): Promise<void> {
  const waitsByLinkId = new Map<string, { id: string; createdAt: Date }>()
  if (links.length > 0) {
    const waits = await db
      .select({
        id: taskWaits.id,
        githubLinkId: taskWaits.githubLinkId,
        createdAt: taskWaits.createdAt,
      })
      .from(taskWaits)
      .where(
        and(
          inArray(
            taskWaits.githubLinkId,
            links.map((link) => link.id),
          ),
          isNull(taskWaits.resolvedAt),
        ),
      )
    for (const wait of waits) {
      if (wait.githubLinkId != null) {
        waitsByLinkId.set(wait.githubLinkId, {
          id: wait.id,
          createdAt: wait.createdAt,
        })
      }
    }
  }

  for (const link of links) {
    const result = await syncLinkFromGithub(
      link,
      undefined,
      onWrite,
      waitsByLinkId.get(link.id) ?? null,
    )
    if (result.isErr() && !isQuietProviderError(result.error)) {
      captureWithFingerprint(result.error, 'api.github-sync.sync-link-failed', {
        extras: { linkId: link.id },
      })
    }
  }
}

async function runSync(origin: string | null): Promise<void> {
  if (!(await hasGithubAccess())) {
    return
  }

  const links = await db.select().from(taskGithubLinks)
  const changedTaskIds = new Set<string>()
  const changedRuleIds = new Set<string>()
  await syncLinks(links, (taskId) => changedTaskIds.add(taskId))

  await syncGithubAssignedIssues({
    onTaskCreated: (taskId) => changedTaskIds.add(taskId),
    onRuleUpdated: (ruleId) => changedRuleIds.add(ruleId),
  })

  for (const id of changedTaskIds) {
    publishChangeEvent({ resource: 'task', id, origin, taskIds: [id] })
  }
  for (const id of changedRuleIds) {
    publishChangeEvent({
      resource: 'github_sync_rule',
      id,
      origin,
      taskIds: [],
    })
  }
}

let inFlightSync: Promise<void> | null = null

// Manual requests and the server scheduler share one pass so overlapping calls
// do not issue duplicate GitHub requests.
export function syncAllGithubLinks(
  origin: string | null = null,
): Promise<void> {
  inFlightSync ??= runSync(origin).finally(() => {
    inFlightSync = null
  })
  return inFlightSync
}

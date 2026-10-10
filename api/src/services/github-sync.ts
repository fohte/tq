import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, inArray, isNull, lt } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, taskWaits } from '#db/schema'
import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import {
  fetchGithubIssueActivity,
  type GithubIssueActivity,
  type GithubIssueActivityEvent,
} from '#integrations/github/activity'
import { GithubApiError, githubProvider } from '#integrations/github/index'
import {
  fetchGithubIssueIfChanged,
  type GithubIssueData,
} from '#integrations/github/issues'
import { getValidAccessToken } from '#integrations/oauth'
import { isQuietProviderError } from '#integrations/quiet-errors'
import { publishChangeEvent } from '#lib/change-events'
import {
  candidateEvents,
  GithubLinkNotifyError,
  isTaskTodo,
  notifyLinkChange,
  pushTaskNotification,
} from '#services/github-sync-notifications'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'
import { checkChecklistItemsForGithubLink } from '#services/task-checklist-progress'

type LinkRow = typeof taskGithubLinks.$inferSelect
type NotifyEvent = LinkRow['notifyEvents'][number]
type UnresolvedWait = { id: string; createdAt: Date }

type SyncLinkError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | GithubLinkNotifyError

function newerActivityEvents(
  link: LinkRow,
  activity: GithubIssueActivity,
  after = link.githubUpdatedAt,
): GithubIssueActivityEvent[] {
  return activity.events.filter(
    (event) =>
      event.occurredAt !== null &&
      (after === null || event.occurredAt.getTime() > after.getTime()),
  )
}

function wasCausedByOtherHuman(
  event: GithubIssueActivityEvent,
  activity: GithubIssueActivity,
): boolean {
  return (
    event.actorType !== 'Bot' &&
    event.login !== null &&
    event.login.toLowerCase() !== activity.authenticatedUserLogin.toLowerCase()
  )
}

function hasReplyActivity(
  link: LinkRow,
  activity: GithubIssueActivity,
  waitCreatedAt: Date,
): boolean {
  const after =
    link.githubUpdatedAt != null &&
    link.githubUpdatedAt.getTime() > waitCreatedAt.getTime()
      ? link.githubUpdatedAt
      : waitCreatedAt
  return newerActivityEvents(link, activity, after).some(
    (event) =>
      ['reviewed', 'commented', 'closed', 'merged'].includes(event.event) &&
      wasCausedByOtherHuman(event, activity),
  )
}

function replyNotificationTitle(link: LinkRow): string {
  return `${link.owner}/${link.repo}#${String(link.number)} received a reply`
}

function changedEvent(
  link: LinkRow,
  issue: GithubIssueData,
  candidates: NotifyEvent[],
  activity: GithubIssueActivity,
): { event: LinkRow['notifyEvents'][number]; title: string } | null {
  const ref = `${link.owner}/${link.repo}#${String(link.number)}`
  const newerEvents = newerActivityEvents(link, activity)

  if (candidates.includes('closed')) {
    const expectedCloseEvent = issue.state === 'merged' ? 'merged' : 'closed'
    const hasExternalClose = newerEvents.some(
      (event) =>
        event.event === expectedCloseEvent &&
        wasCausedByOtherHuman(event, activity),
    )
    if (hasExternalClose) {
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
  }

  if (candidates.includes('reopened')) {
    const hasExternalReopen = newerEvents.some(
      (event) =>
        event.event === 'reopened' && wasCausedByOtherHuman(event, activity),
    )
    if (hasExternalReopen) {
      return { event: 'reopened', title: `${ref} was reopened` }
    }
  }

  const newComments = newerEvents.filter(
    (event) =>
      event.event === 'commented' && wasCausedByOtherHuman(event, activity),
  ).length
  if (candidates.includes('comments') && newComments > 0) {
    return {
      event: 'comments',
      title: `${ref}: ${String(newComments)} new ${
        newComments === 1 ? 'comment' : 'comments'
      }`,
    }
  }

  if (candidates.includes('other')) {
    const hasExternalOtherActivity = newerEvents.some(
      (event) =>
        !['closed', 'merged', 'reopened', 'commented'].includes(event.event) &&
        wasCausedByOtherHuman(event, activity),
    )
    if (!hasExternalOtherActivity) {
      return null
    }

    return { event: 'other', title: `${ref} has new activity` }
  }

  return null
}

function matchesStoredGithubState(link: LinkRow) {
  return and(
    eq(taskGithubLinks.id, link.id),
    eq(taskGithubLinks.state, link.state),
    link.commentsCount === null
      ? isNull(taskGithubLinks.commentsCount)
      : eq(taskGithubLinks.commentsCount, link.commentsCount),
    link.githubUpdatedAt === null
      ? isNull(taskGithubLinks.githubUpdatedAt)
      : eq(taskGithubLinks.githubUpdatedAt, link.githubUpdatedAt),
  )
}

function findUnresolvedWait(
  githubLinkId: string,
): ResultAsync<UnresolvedWait | null, never> {
  return ResultAsync.fromSafePromise(
    db
      .select({ id: taskWaits.id, createdAt: taskWaits.createdAt })
      .from(taskWaits)
      .where(
        and(
          eq(taskWaits.githubLinkId, githubLinkId),
          isNull(taskWaits.resolvedAt),
        ),
      )
      .then((rows) => rows[0] ?? null),
  )
}

function updateLinkAndNotify(
  link: LinkRow,
  issue: GithubIssueData,
  etag: string | null,
  lastSyncedAt: Date,
  activeWait: UnresolvedWait | null,
  notification: NonNullable<ReturnType<typeof changedEvent>> | null,
  shouldResolveWait: boolean,
  onWrite?: (taskId: string) => void,
): ResultAsync<void, GithubLinkNotifyError> {
  return ResultAsync.fromSafePromise(
    db.transaction(async (tx) => {
      const updatedLinks = await tx
        .update(taskGithubLinks)
        .set({
          title: issue.title,
          state: issue.state,
          commentsCount: issue.commentsCount,
          githubUpdatedAt: new Date(issue.githubUpdatedAt),
          stateReason: issue.stateReason,
          etag,
          lastSyncedAt,
        })
        .where(matchesStoredGithubState(link))
        .returning({ id: taskGithubLinks.id })

      if (
        updatedLinks.length > 0 &&
        link.state !== 'merged' &&
        issue.state === 'merged'
      ) {
        await checkChecklistItemsForGithubLink(tx, link.id)
      }
      const resolvedWaits =
        updatedLinks.length > 0 && shouldResolveWait && activeWait != null
          ? await tx
              .update(taskWaits)
              .set({ resolvedAt: new Date() })
              .where(
                and(
                  eq(taskWaits.id, activeWait.id),
                  isNull(taskWaits.resolvedAt),
                ),
              )
              .returning({ id: taskWaits.id })
          : []
      return { updatedLinks, resolvedWait: resolvedWaits.length > 0 }
    }),
  ).andThen(({ updatedLinks, resolvedWait }) => {
    if (updatedLinks.length === 0) {
      return okAsync(undefined)
    }
    onWrite?.(link.taskId)
    if (resolvedWait) {
      return pushTaskNotification(link, replyNotificationTitle(link))
    }
    if (notification === null) {
      return okAsync(undefined)
    }

    return notifyLinkChange(link, notification)
  })
}

function syncChangedIssue(
  link: LinkRow,
  issue: GithubIssueData,
  etag: string | null,
  lastSyncedAt: Date,
  activeWait: UnresolvedWait | null,
  onWrite?: (taskId: string) => void,
): ResultAsync<void, SyncLinkError> {
  const candidates = candidateEvents(link, issue)
  const selectedCandidates = candidates.filter((event) =>
    link.notifyEvents.includes(event),
  )
  const shouldInspectWait = activeWait != null && candidates.length > 0
  const inspectActivity = (isTodo: boolean) => {
    if (!shouldInspectWait && !isTodo) {
      return updateLinkAndNotify(
        link,
        issue,
        etag,
        lastSyncedAt,
        activeWait,
        null,
        false,
        onWrite,
      )
    }
    return fetchGithubIssueActivity({
      owner: link.owner,
      repo: link.repo,
      number: link.number,
    }).andThen((activity) => {
      const notification =
        isTodo && selectedCandidates.length > 0
          ? changedEvent(link, issue, selectedCandidates, activity)
          : null
      const shouldResolveWait =
        shouldInspectWait &&
        hasReplyActivity(link, activity, activeWait.createdAt)
      return updateLinkAndNotify(
        link,
        issue,
        etag,
        lastSyncedAt,
        activeWait,
        notification,
        shouldResolveWait,
        onWrite,
      )
    })
  }

  return selectedCandidates.length > 0
    ? isTaskTodo(link).andThen(inspectActivity)
    : inspectActivity(false)
}

function updateUnchangedLink(
  link: LinkRow,
  lastSyncedAt: Date,
): ResultAsync<void, never> {
  return ResultAsync.fromSafePromise(
    db
      .update(taskGithubLinks)
      .set({ lastSyncedAt })
      .where(
        and(
          matchesStoredGithubState(link),
          lt(taskGithubLinks.lastSyncedAt, lastSyncedAt),
        ),
      ),
  ).map(() => undefined)
}

// Store the pass start so network latency does not shorten the next scheduler interval.
export function syncLinkFromGithub(
  link: LinkRow,
  syncStartedAt = new Date(),
  onWrite?: (taskId: string) => void,
  unresolvedWait?: UnresolvedWait | null,
): ResultAsync<void, SyncLinkError> {
  if (link.state === 'merged') {
    return okAsync(undefined)
  }

  const lastSyncedAt =
    syncStartedAt.getTime() < link.lastSyncedAt.getTime()
      ? link.lastSyncedAt
      : syncStartedAt

  return fetchGithubIssueIfChanged(
    { owner: link.owner, repo: link.repo, number: link.number },
    link.etag,
  ).andThen((result) => {
    if (result.notModified) {
      return updateUnchangedLink(link, lastSyncedAt)
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

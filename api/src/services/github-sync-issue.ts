import { and, eq, isNull, lt } from 'drizzle-orm'
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
import { GithubApiError } from '#integrations/github/index'
import { type GithubIssueData } from '#integrations/github/issues'
import {
  candidateEvents,
  GithubLinkNotifyError,
  isTaskTodo,
  notifyLinkChange,
  pushTaskNotification,
} from '#services/github-sync-notifications'
import type { UnresolvedWait } from '#services/github-sync-subject-waits'
import { checkChecklistItemsForGithubLink } from '#services/task-checklist-progress'

type LinkRow = typeof taskGithubLinks.$inferSelect
type NotifyEvent = LinkRow['notifyEvents'][number]

export type SyncLinkError =
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

export function findUnresolvedWait(
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

export function syncChangedIssue(
  link: LinkRow,
  issue: GithubIssueData,
  etag: string | null,
  lastSyncedAt: Date,
  activeWait: UnresolvedWait | null,
  onWrite?: (taskId: string) => void,
  prefetchedActivity: GithubIssueActivity | null = null,
): ResultAsync<void, SyncLinkError> {
  const candidates = candidateEvents(link, issue)
  const selectedCandidates = candidates.filter((event) =>
    link.notifyEvents.includes(event),
  )
  const shouldInspectWait =
    link.role === 'blocker' && activeWait != null && candidates.length > 0
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
    const activityResult =
      prefetchedActivity == null
        ? fetchGithubIssueActivity({
            owner: link.owner,
            repo: link.repo,
            number: link.number,
          })
        : okAsync(prefetchedActivity)
    return activityResult.andThen((activity) => {
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

export function updateUnchangedLink(
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

import { captureWithFingerprint } from '@fohte/service-kit/observability'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
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
import { syncGithubAssignedIssues } from '#services/github-sync-rules'
import { sendPush } from '#services/push'
import { checkChecklistItemsForGithubLink } from '#services/task-checklist-progress'

type LinkRow = typeof taskGithubLinks.$inferSelect
type NotifyEvent = LinkRow['notifyEvents'][number]

type SyncLinkError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | GithubLinkNotifyError

class GithubLinkNotifyError extends Error {
  constructor(error: unknown) {
    super('Failed to notify about a GitHub link change', { cause: error })
    this.name = 'GithubLinkNotifyError'
  }
}

function candidateEvents(link: LinkRow, issue: GithubIssueData): NotifyEvent[] {
  const candidates: NotifyEvent[] = []
  if (link.state === 'open' && issue.state !== 'open') {
    candidates.push('closed')
  }
  if (link.state !== 'open' && issue.state === 'open') {
    candidates.push('reopened')
  }
  if (link.commentsCount !== null && issue.commentsCount > link.commentsCount) {
    candidates.push('comments')
  }
  if (
    link.githubUpdatedAt !== null &&
    new Date(issue.githubUpdatedAt).getTime() !== link.githubUpdatedAt.getTime()
  ) {
    candidates.push('other')
  }
  return candidates
}

function changedEvent(
  link: LinkRow,
  issue: GithubIssueData,
  candidates: NotifyEvent[],
  activity: GithubIssueActivity,
): { event: LinkRow['notifyEvents'][number]; title: string } | null {
  const ref = `${link.owner}/${link.repo}#${String(link.number)}`
  const newerEvents = activity.events.filter(
    (event) =>
      event.occurredAt !== null &&
      (link.githubUpdatedAt === null ||
        event.occurredAt.getTime() > link.githubUpdatedAt.getTime()),
  )
  const wasCausedByOtherHuman = (event: GithubIssueActivityEvent) =>
    event.actorType !== 'Bot' &&
    event.login !== null &&
    event.login.toLowerCase() !== activity.authenticatedUserLogin.toLowerCase()

  if (candidates.includes('closed')) {
    const expectedCloseEvent = issue.state === 'merged' ? 'merged' : 'closed'
    const hasExternalClose = newerEvents.some(
      (event) =>
        event.event === expectedCloseEvent && wasCausedByOtherHuman(event),
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
      (event) => event.event === 'reopened' && wasCausedByOtherHuman(event),
    )
    if (hasExternalReopen) {
      return { event: 'reopened', title: `${ref} was reopened` }
    }
  }

  const newComments = newerEvents.filter(
    (event) => event.event === 'commented' && wasCausedByOtherHuman(event),
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
        wasCausedByOtherHuman(event),
    )
    if (!hasExternalOtherActivity) {
      return null
    }

    return { event: 'other', title: `${ref} has new activity` }
  }

  return null
}

function toNotifyError(error: unknown): GithubLinkNotifyError {
  return new GithubLinkNotifyError(error)
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

function notifyLinkChange(
  link: LinkRow,
  notification: NonNullable<ReturnType<typeof changedEvent>>,
): ResultAsync<void, GithubLinkNotifyError> {
  if (!link.notifyEvents.includes(notification.event)) {
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
    toNotifyError,
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
      toNotifyError,
    ).map(() => undefined)
  })
}

function isTaskTodo(
  link: LinkRow,
): ResultAsync<boolean, GithubLinkNotifyError> {
  return ResultAsync.fromPromise(
    db
      .select({ status: tasks.status })
      .from(tasks)
      .where(eq(tasks.id, link.taskId))
      .then((rows) => rows[0]?.status === 'todo'),
    toNotifyError,
  )
}

// Store the pass start so network latency does not shorten the next scheduler interval.
export function syncLinkFromGithub(
  link: LinkRow,
  syncStartedAt = new Date(),
  onWrite?: (taskId: string) => void,
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

    const { issue, etag } = result
    const updateLink = (
      notification: NonNullable<ReturnType<typeof changedEvent>> | null,
    ) =>
      ResultAsync.fromSafePromise(
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
          return updatedLinks
        }),
      ).andThen((updatedLinks) => {
        if (updatedLinks.length === 0) {
          return okAsync(undefined)
        }
        onWrite?.(link.taskId)
        if (notification === null) return okAsync(undefined)

        return notifyLinkChange(link, notification)
      })
    const candidates = candidateEvents(link, issue)
    const selectedCandidates = candidates.filter((event) =>
      link.notifyEvents.includes(event),
    )
    if (selectedCandidates.length === 0) {
      return updateLink(null)
    }

    return isTaskTodo(link).andThen((isTodo) => {
      if (!isTodo) {
        return updateLink(null)
      }

      return fetchGithubIssueActivity({
        owner: link.owner,
        repo: link.repo,
        number: link.number,
      }).andThen((activity) =>
        updateLink(changedEvent(link, issue, selectedCandidates, activity)),
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
  for (const link of links) {
    const result = await syncLinkFromGithub(link, undefined, onWrite)
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

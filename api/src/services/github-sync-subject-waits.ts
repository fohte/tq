import { and, eq, isNull } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, taskWaits } from '#db/schema'
import {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import type {
  GithubIssueActivity,
  GithubIssueActivityEvent,
} from '#integrations/github/activity'
import { fetchGithubIssueActivity } from '#integrations/github/activity'
import { GithubApiError } from '#integrations/github/index'
import {
  fetchGithubIssueIfChanged,
  type GithubIssueData,
} from '#integrations/github/issues'
import {
  GithubLinkNotifyError,
  pushTaskNotification,
} from '#services/github-sync-notifications'

type LinkRow = typeof taskGithubLinks.$inferSelect
export type UnresolvedWait = { id: string; createdAt: Date }
type SubjectWaitSyncError =
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | GithubLinkNotifyError

const submittedReviewStates = [
  'approved',
  'changes_requested',
  'commented',
] as const

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

function hasSubjectWaitActivity(
  activity: GithubIssueActivity,
  waitCreatedAt: Date,
): boolean {
  return activity.events.some((event) => {
    const occurredAt =
      event.event === 'reviewed' ? event.submittedAt : event.occurredAt
    if (occurredAt == null || occurredAt.getTime() <= waitCreatedAt.getTime()) {
      return false
    }

    if (event.event === 'closed' || event.event === 'merged') {
      return true
    }

    if (event.event === 'commented') {
      return wasCausedByOtherHuman(event, activity)
    }

    return (
      event.event === 'reviewed' &&
      submittedReviewStates.some((state) => state === event.reviewState) &&
      wasCausedByOtherHuman(event, activity)
    )
  })
}

function syncSubjectWait(
  link: LinkRow,
  wait: UnresolvedWait,
  onWrite?: (taskId: string) => void,
): ResultAsync<GithubIssueActivity, SubjectWaitSyncError> {
  return fetchGithubIssueActivity({
    owner: link.owner,
    repo: link.repo,
    number: link.number,
  }).andThen((activity) => {
    if (!hasSubjectWaitActivity(activity, wait.createdAt)) {
      return okAsync(activity)
    }

    return ResultAsync.fromSafePromise(
      db
        .update(taskWaits)
        .set({ resolvedAt: new Date() })
        .where(and(eq(taskWaits.id, wait.id), isNull(taskWaits.resolvedAt)))
        .returning({ id: taskWaits.id }),
    ).andThen((resolvedWaits) => {
      if (resolvedWaits.length === 0) {
        return okAsync(activity)
      }

      onWrite?.(link.taskId)
      const title = `${link.owner}/${link.repo}#${String(link.number)} received a reply`
      return pushTaskNotification(link, title).map(() => activity)
    })
  })
}

export function syncSubjectWaitAndIssue<TError>(
  link: LinkRow,
  activeWait: ResultAsync<UnresolvedWait | null, never>,
  onWrite: ((taskId: string) => void) | undefined,
  syncUnchanged: () => ResultAsync<void, TError>,
  syncChanged: (
    activity: GithubIssueActivity | null,
    issue: GithubIssueData,
    etag: string | null,
  ) => ResultAsync<void, TError>,
): ResultAsync<void, TError | SubjectWaitSyncError> {
  return activeWait.andThen((wait) => {
    const activityResult =
      wait == null
        ? okAsync<GithubIssueActivity | null, SubjectWaitSyncError>(null)
        : syncSubjectWait(link, wait, onWrite).map((activity) => activity)

    return activityResult.andThen((activity) => {
      if (link.state === 'merged') {
        return okAsync(undefined)
      }

      return fetchGithubIssueIfChanged(
        { owner: link.owner, repo: link.repo, number: link.number },
        link.etag,
      ).andThen((result) => {
        if (result.notModified) {
          return syncUnchanged()
        }

        return syncChanged(activity, result.issue, result.etag)
      })
    })
  })
}

import { eq } from 'drizzle-orm'
import { okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import type { GithubIssueData } from '#integrations/github/issues'
import { sendPush } from '#services/push'

type LinkRow = typeof taskGithubLinks.$inferSelect
type NotifyEvent = LinkRow['notifyEvents'][number]

export class GithubLinkNotifyError extends Error {
  constructor(error: unknown) {
    super('Failed to notify about a GitHub link change', { cause: error })
    this.name = 'GithubLinkNotifyError'
  }
}

export function candidateEvents(
  link: LinkRow,
  issue: GithubIssueData,
): NotifyEvent[] {
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

function toNotifyError(error: unknown): GithubLinkNotifyError {
  return new GithubLinkNotifyError(error)
}

export function pushTaskNotification(
  link: LinkRow,
  title: string,
): ResultAsync<void, GithubLinkNotifyError> {
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
          title,
          body: `#${String(task.number)} ${task.title}`,
          taskId: task.id,
          url: `https://${APP_DOMAIN}/tasks/${task.id}`,
        },
      ),
      toNotifyError,
    ).map(() => undefined)
  })
}

export function notifyLinkChange(
  link: LinkRow,
  notification: { event: NotifyEvent; title: string },
): ResultAsync<void, GithubLinkNotifyError> {
  if (!link.notifyEvents.includes(notification.event)) {
    return okAsync(undefined)
  }

  return pushTaskNotification(link, notification.title)
}

export function isTaskTodo(
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

import { and, eq } from 'drizzle-orm'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import type { GithubApiError } from '#integrations/github/index'
import type {
  GithubIssueData,
  GithubResourceRef,
} from '#integrations/github/issues'
import { fetchGithubIssue } from '#integrations/github/issues'
import { firstOrErr, type RowNotFoundError } from '#lib/drizzle-utils'

export class TaskNotFoundError extends Error {
  constructor() {
    super('Task not found')
    this.name = 'TaskNotFoundError'
  }
}

export class TaskAlreadyLinkedError extends Error {
  constructor() {
    super('Task is already linked to a GitHub issue or pull request')
    this.name = 'TaskAlreadyLinkedError'
  }
}

export class GithubResourceAlreadyLinkedError extends Error {
  readonly linkedTaskId: string

  constructor(linkedTaskId: string) {
    super('This GitHub issue or pull request is already linked to another task')
    this.name = 'GithubResourceAlreadyLinkedError'
    this.linkedTaskId = linkedTaskId
  }
}

export class GithubLinkNotFoundError extends Error {
  constructor() {
    super('GitHub link not found')
    this.name = 'GithubLinkNotFoundError'
  }
}

// A link row's taskId should always resolve to a task: the FK's `onDelete:
// cascade` deletes the link whenever its task is deleted.
export class GithubLinkConsistencyError extends Error {
  constructor(taskId: string) {
    super(`Task not found for GitHub link (taskId: ${taskId})`)
    this.name = 'GithubLinkConsistencyError'
  }
}

type TaskRow = typeof tasks.$inferSelect
type LinkRow = typeof taskGithubLinks.$inferSelect

export function findLinkByRef(
  ref: GithubResourceRef,
): ResultAsync<LinkRow | null, never> {
  return ResultAsync.fromSafePromise(
    db.query.taskGithubLinks.findFirst({
      where: and(
        eq(taskGithubLinks.owner, ref.owner),
        eq(taskGithubLinks.repo, ref.repo),
        eq(taskGithubLinks.number, ref.number),
      ),
    }),
  ).map((link) => link ?? null)
}

export function findLinkByTaskId(
  taskId: string,
): ResultAsync<LinkRow | null, never> {
  return ResultAsync.fromSafePromise(
    db.query.taskGithubLinks.findFirst({
      where: eq(taskGithubLinks.taskId, taskId),
    }),
  ).map((link) => link ?? null)
}

function findTaskForLink(
  link: LinkRow,
): ResultAsync<TaskRow, GithubLinkConsistencyError> {
  return ResultAsync.fromSafePromise(
    db.query.tasks.findFirst({ where: eq(tasks.id, link.taskId) }),
  ).andThen((task) =>
    task
      ? okAsync(task)
      : errAsync(new GithubLinkConsistencyError(link.taskId)),
  )
}

function insertLink(
  taskId: string,
  issue: GithubIssueData,
): ResultAsync<LinkRow, RowNotFoundError> {
  return ResultAsync.fromSafePromise(
    db
      .insert(taskGithubLinks)
      .values({
        taskId,
        owner: issue.owner,
        repo: issue.repo,
        number: issue.number,
        kind: issue.kind,
        url: issue.url,
        state: issue.state,
        title: issue.title,
      })
      .returning(),
  ).andThen(firstOrErr)
}

export function resolveGithubUrl(
  ref: GithubResourceRef,
): ResultAsync<
  | { existingTask: TaskRow; existingLink: LinkRow }
  | { preview: GithubIssueData },
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | GithubLinkConsistencyError
> {
  return findLinkByRef(ref).andThen((link) => {
    if (!link) {
      return fetchGithubIssue(ref).map((preview) => ({ preview }))
    }
    return findTaskForLink(link).map((existingTask) => ({
      existingTask,
      existingLink: link,
    }))
  })
}

export function createTaskFromGithubUrl(
  ref: GithubResourceRef,
): ResultAsync<
  { task: TaskRow; link: LinkRow; created: boolean },
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | GithubLinkConsistencyError
  | RowNotFoundError
> {
  return findLinkByRef(ref).andThen((existing) => {
    if (existing) {
      return findTaskForLink(existing).map((task) => ({
        task,
        link: existing,
        created: false,
      }))
    }

    return fetchGithubIssue(ref).andThen((issue) =>
      ResultAsync.fromSafePromise(
        db
          .insert(tasks)
          .values({ title: issue.title, description: issue.body })
          .returning(),
      )
        .andThen(firstOrErr)
        .andThen((task) =>
          insertLink(task.id, issue).map((link) => ({
            task,
            link,
            created: true,
          })),
        ),
    )
  })
}

export function linkTaskToGithubUrl(
  taskId: string,
  ref: GithubResourceRef,
): ResultAsync<
  LinkRow,
  | TaskNotFoundError
  | TaskAlreadyLinkedError
  | GithubResourceAlreadyLinkedError
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError
  | RowNotFoundError
> {
  return ResultAsync.fromSafePromise(
    db.query.tasks.findFirst({ where: eq(tasks.id, taskId) }),
  ).andThen((task) => {
    if (!task) return errAsync(new TaskNotFoundError())

    return findLinkByTaskId(taskId).andThen((existingTaskLink) => {
      if (existingTaskLink) return errAsync(new TaskAlreadyLinkedError())

      return findLinkByRef(ref).andThen((existingResourceLink) => {
        if (existingResourceLink) {
          return errAsync(
            new GithubResourceAlreadyLinkedError(existingResourceLink.taskId),
          )
        }

        return fetchGithubIssue(ref).andThen((issue) =>
          insertLink(taskId, issue),
        )
      })
    })
  })
}

export function unlinkTask(
  taskId: string,
): ResultAsync<void, GithubLinkNotFoundError> {
  return ResultAsync.fromSafePromise(
    db
      .delete(taskGithubLinks)
      .where(eq(taskGithubLinks.taskId, taskId))
      .returning(),
  ).andThen((deleted) =>
    deleted.length > 0
      ? okAsync(undefined)
      : errAsync(new GithubLinkNotFoundError()),
  )
}

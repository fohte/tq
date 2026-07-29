import { and, eq } from 'drizzle-orm'
import { err, errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

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

function toResultAsync<T, E>(
  promise: Promise<Result<T, E>>,
): ResultAsync<T, E> {
  return ResultAsync.fromSafePromise(promise).andThen((result) => result)
}

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

const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(cause: unknown, constraintName: string): boolean {
  return (
    cause instanceof Error &&
    'code' in cause &&
    cause.code === UNIQUE_VIOLATION &&
    'constraint_name' in cause &&
    cause.constraint_name === constraintName
  )
}

// The caller already checked findLinkByTaskId/findLinkByRef before calling
// this, but that check-then-insert isn't atomic: a concurrent request can
// insert the conflicting row in between, which the DB's unique constraints
// (task_github_links_task_id_unique, uq_task_github_links_repo_number) still
// catch. Converting that race into the same business error the pre-check
// returns keeps the route's response a 409 instead of an unhandled 500.
async function insertLink(
  taskId: string,
  ref: GithubResourceRef,
  issue: GithubIssueData,
): Promise<
  Result<
    LinkRow,
    TaskAlreadyLinkedError | GithubResourceAlreadyLinkedError | RowNotFoundError
  >
> {
  // Must catch the unique constraint violation to convert a concurrent
  // duplicate link into a business error (see comment above); anything else
  // is rethrown for the app-level error boundary to capture, matching the
  // throw below.
  // eslint-disable-next-line no-restricted-syntax -- see comment above
  try {
    const rows = await db
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
        body: issue.body,
      })
      .returning()
    return firstOrErr(rows)
  } catch (cause) {
    if (isUniqueViolation(cause, 'task_github_links_task_id_unique')) {
      return err(new TaskAlreadyLinkedError())
    }
    if (isUniqueViolation(cause, 'uq_task_github_links_repo_number')) {
      const existing = await findLinkByRef(ref).unwrapOr(null)
      return err(
        new GithubResourceAlreadyLinkedError(existing?.taskId ?? taskId),
      )
    }
    // Not a recognized conflict; rethrow so the app-level error boundary
    // reports it.
    // eslint-disable-next-line no-restricted-syntax -- see comment above
    throw cause
  }
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
  | TaskAlreadyLinkedError
  | GithubResourceAlreadyLinkedError
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
          toResultAsync(insertLink(task.id, ref, issue)).map((link) => ({
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
          toResultAsync(insertLink(taskId, ref, issue)),
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

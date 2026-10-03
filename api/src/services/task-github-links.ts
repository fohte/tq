import { and, eq } from 'drizzle-orm'
import { err, errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

import { db, type DbTransaction } from '#db/connection'
import type { GithubNotifyEvent } from '#db/schema'
import { defaultGithubNotifyEvents, taskGithubLinks, tasks } from '#db/schema'
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
import { firstOrErr, RowNotFoundError } from '#lib/drizzle-utils'
import type { EditAuthor } from '#lib/edits'
import { recordGithubLinked } from '#lib/task-events'

export class TaskNotFoundError extends Error {
  constructor() {
    super('Task not found')
    this.name = 'TaskNotFoundError'
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

function linkInsertValues(
  taskId: string,
  issue: GithubIssueData,
  notifyEvents?: GithubNotifyEvent[],
): typeof taskGithubLinks.$inferInsert {
  const role = 'subject'
  return {
    taskId,
    owner: issue.owner,
    repo: issue.repo,
    number: issue.number,
    role,
    notifyEvents: notifyEvents ?? defaultGithubNotifyEvents(role),
    kind: issue.kind,
    url: issue.url,
    state: issue.state,
    title: issue.title,
    commentsCount: issue.commentsCount,
    githubUpdatedAt: new Date(issue.githubUpdatedAt),
    stateReason: issue.stateReason,
  }
}

function findLinkByRef(
  ref: GithubResourceRef,
): ResultAsync<LinkRow | null, never> {
  return ResultAsync.fromSafePromise(
    db.query.taskGithubLinks.findFirst({
      where: and(
        eq(taskGithubLinks.owner, ref.owner),
        eq(taskGithubLinks.repo, ref.repo),
        eq(taskGithubLinks.number, ref.number),
        eq(taskGithubLinks.role, 'subject'),
      ),
    }),
  ).map((link) => link ?? null)
}

export function findLinksByTaskId(
  taskId: string,
): ResultAsync<LinkRow[], never> {
  return ResultAsync.fromSafePromise(
    db.query.taskGithubLinks.findMany({
      where: eq(taskGithubLinks.taskId, taskId),
    }),
  )
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

function isMatchingViolation(cause: unknown, constraintName: string): boolean {
  return (
    cause instanceof Error &&
    'code' in cause &&
    cause.code === UNIQUE_VIOLATION &&
    'constraint_name' in cause &&
    cause.constraint_name === constraintName
  )
}

// drizzle-orm wraps every query failure in a DrizzleQueryError, with the
// driver's own error (postgres.js's PostgresError, carrying `code` and
// `constraint_name`) as `.cause` — so the constraint check must look at both
// the caught value and its `.cause`, not just the former.
function isUniqueViolation(cause: unknown, constraintName: string): boolean {
  return (
    isMatchingViolation(cause, constraintName) ||
    (cause instanceof Error && isMatchingViolation(cause.cause, constraintName))
  )
}

// Accepted by unlinkTask so it can run standalone (against
// `db`) or as part of a larger transaction (against the `tx` handed to
// `db.transaction`). createTaskFromIssueData needs the latter to make its
// task insert and link insert atomic; linkTaskToGithubUrl/unlinkTask need it
// to make their link write and its task_events row atomic.
type Executor = typeof db | DbTransaction

type LinkConflictError = GithubResourceAlreadyLinkedError | RowNotFoundError

// Converts a concurrent insert conflict on either GitHub-link uniqueness
// rule into GithubResourceAlreadyLinkedError; a cause already in
// LinkConflictError passes through unchanged.
async function classifyLinkConflict(
  cause: unknown,
  taskId: string,
  ref: GithubResourceRef,
): Promise<Result<never, LinkConflictError>> {
  if (
    cause instanceof GithubResourceAlreadyLinkedError ||
    cause instanceof RowNotFoundError
  ) {
    return err(cause)
  }
  if (
    isUniqueViolation(cause, 'uq_task_github_links_subject_repo_number') ||
    isUniqueViolation(cause, 'uq_task_github_links_task_repo_number')
  ) {
    const existing = await findLinkByRef(ref).unwrapOr(null)
    return err(new GithubResourceAlreadyLinkedError(existing?.taskId ?? taskId))
  }
  // Not a recognized conflict; rethrow so the app-level error boundary
  // reports it.
  // eslint-disable-next-line no-restricted-syntax -- interop boundary: caught by this function's Promise-based callers (the try/catch below, or ResultAsync.fromSafePromise in createTaskFromIssueData)
  throw cause
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

// DB-only counterpart to resolveGithubUrl: never calls the GitHub API, so it
// resolves to `null` for an unlinked ref instead of falling back to a
// preview fetch.
export function findTaskByGithubRef(
  ref: GithubResourceRef,
): ResultAsync<
  { task: TaskRow; link: LinkRow } | null,
  GithubLinkConsistencyError
> {
  return findLinkByRef(ref).andThen((link) => {
    if (!link) return okAsync(null)
    return findTaskForLink(link).map((task) => ({ task, link }))
  })
}

// The task insert and link insert must commit or roll back together. A
// unique conflict is classified after the transaction settles because
// PostgreSQL rejects follow-up queries while the transaction is aborted.
export function createTaskFromIssueData(
  issue: GithubIssueData,
  options?: { projectId?: string | null },
): ResultAsync<{ task: TaskRow; link: LinkRow }, LinkConflictError> {
  let insertedTaskId: string | undefined

  return ResultAsync.fromPromise<{ task: TaskRow; link: LinkRow }, unknown>(
    db.transaction(async (tx) => {
      // The task's description is intentionally left empty: it's the
      // owner's own notes, not a mirror of the issue body.
      const taskResult = firstOrErr(
        await tx
          .insert(tasks)
          .values({
            title: issue.title,
            projectId: options?.projectId ?? null,
          })
          .returning(),
      )
      if (taskResult.isErr()) {
        // eslint-disable-next-line no-restricted-syntax -- interop boundary: see comment above createTaskFromIssueData
        throw taskResult.error
      }
      const task = taskResult.value
      insertedTaskId = task.id

      const linkResult = firstOrErr(
        await tx
          .insert(taskGithubLinks)
          .values(linkInsertValues(task.id, issue))
          .returning(),
      )
      if (linkResult.isErr()) {
        // eslint-disable-next-line no-restricted-syntax -- interop boundary: see comment above createTaskFromIssueData
        throw linkResult.error
      }

      return { task, link: linkResult.value }
    }),
    (cause) => cause,
  ).orElse((cause) =>
    ResultAsync.fromSafePromise(
      classifyLinkConflict(cause, insertedTaskId ?? '', issue),
    ).andThen((result) => result),
  )
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
      createTaskFromIssueData(issue).map(({ task, link }) => ({
        task,
        link,
        created: true,
      })),
    )
  })
}

// The link insert and its task_events row must commit or roll back
// together: a link insert followed by a separate recordGithubLinked
// write would leave the timeline missing an entry if the process crashes (or
// the write fails) between the two. The GitHub API fetch happens before the
// transaction opens since it can't participate in it.
//
// postgres.js marks the whole transaction failed as soon as a query rejects,
// even if the immediate caller catches it (see
// https://github.com/porsager/postgres#transactions). Let a link conflict
// reject this callback so the transaction rolls back before `.orElse`
// reclassifies it.
export function linkTaskToGithubUrl(
  taskId: string,
  ref: GithubResourceRef,
  author: EditAuthor,
  notifyEvents?: GithubNotifyEvent[],
): ResultAsync<
  LinkRow,
  | TaskNotFoundError
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

    return findLinkByRef(ref).andThen((existingResourceLink) => {
      if (existingResourceLink) {
        return errAsync(
          new GithubResourceAlreadyLinkedError(existingResourceLink.taskId),
        )
      }

      return fetchGithubIssue(ref).andThen((issue) =>
        ResultAsync.fromPromise<LinkRow, unknown>(
          db.transaction(async (tx) => {
            const linkResult = firstOrErr(
              await tx
                .insert(taskGithubLinks)
                .values(linkInsertValues(taskId, issue, notifyEvents))
                .returning(),
            )
            if (linkResult.isErr()) {
              // eslint-disable-next-line no-restricted-syntax -- interop boundary: see comment above linkTaskToGithubUrl
              throw linkResult.error
            }
            const link = linkResult.value
            await recordGithubLinked(
              tx,
              taskId,
              {
                owner: link.owner,
                repo: link.repo,
                number: link.number,
                kind: link.kind,
              },
              author,
            )
            return link
          }),
          (cause) => cause,
        ).orElse((cause) =>
          ResultAsync.fromSafePromise(
            classifyLinkConflict(cause, taskId, ref),
          ).andThen((result) => result),
        ),
      )
    })
  })
}

export function unlinkTask(
  executor: Executor,
  taskId: string,
  linkId: string,
): ResultAsync<LinkRow, GithubLinkNotFoundError> {
  return ResultAsync.fromSafePromise(
    executor
      .delete(taskGithubLinks)
      .where(
        and(eq(taskGithubLinks.id, linkId), eq(taskGithubLinks.taskId, taskId)),
      )
      .returning(),
  ).andThen((deleted) => {
    const [link] = deleted
    return link ? okAsync(link) : errAsync(new GithubLinkNotFoundError())
  })
}

export function updateGithubLinkNotifyEvents(
  executor: Executor,
  taskId: string,
  linkId: string,
  notifyEvents: GithubNotifyEvent[],
): ResultAsync<LinkRow, GithubLinkNotFoundError> {
  return ResultAsync.fromSafePromise(
    executor
      .update(taskGithubLinks)
      .set({ notifyEvents, updatedAt: new Date() })
      .where(
        and(eq(taskGithubLinks.id, linkId), eq(taskGithubLinks.taskId, taskId)),
      )
      .returning(),
  ).andThen((updated) => {
    const [link] = updated
    return link ? okAsync(link) : errAsync(new GithubLinkNotFoundError())
  })
}

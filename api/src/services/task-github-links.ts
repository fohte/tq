import { and, eq } from 'drizzle-orm'
import { err, errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

import { db, type DbTransaction } from '#db/connection'
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

function findLinkByRef(
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

// Accepted by insertLink/unlinkTask so they can run standalone (against
// `db`) or as part of a larger transaction (against the `tx` handed to
// `db.transaction`). createTaskFromIssueData needs the latter to make its
// task insert and link insert atomic; linkTaskToGithubUrl/unlinkTask need it
// to make their link write and its task_events row atomic.
type Executor = typeof db | DbTransaction

type LinkConflictError = GithubResourceAlreadyLinkedError | RowNotFoundError

// Converts a concurrent insert conflict on uq_task_github_links_repo_number
// into GithubResourceAlreadyLinkedError; a cause already in LinkConflictError
// passes through unchanged.
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
  if (isUniqueViolation(cause, 'uq_task_github_links_repo_number')) {
    const existing = await findLinkByRef(ref).unwrapOr(null)
    return err(new GithubResourceAlreadyLinkedError(existing?.taskId ?? taskId))
  }
  // Not a recognized conflict; rethrow so the app-level error boundary
  // reports it.
  // eslint-disable-next-line no-restricted-syntax -- interop boundary: caught by this function's Promise-based callers (the try/catch below, or ResultAsync.fromSafePromise in createTaskFromIssueData)
  throw cause
}

async function insertLink(
  executor: Executor,
  taskId: string,
  ref: GithubResourceRef,
  issue: GithubIssueData,
): Promise<Result<LinkRow, LinkConflictError>> {
  // eslint-disable-next-line no-restricted-syntax -- interop boundary: converts the DB's thrown unique-violation into classifyLinkConflict's Result
  try {
    const rows = await executor
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
    return classifyLinkConflict(cause, taskId, ref)
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

// The task insert and the link insert must commit or roll back together:
// without a transaction, a concurrent link created for the same issue
// between the two inserts (see insertLink's comment) leaves this task
// inserted with no link pointing at it.
//
// The link insert isn't run through insertLink here: classifying its
// failure (via classifyLinkConflict) can require a follow-up query, and a
// transaction/savepoint that just failed rejects any further query until it
// rolls back — which only happens once this callback's returned promise
// settles. So a raw failure is left uncaught here and thrown as-is (an
// interop boundary: db.transaction() is a plain-Promise API with no way to
// signal "roll back" other than a rejection), then classified in `.orElse`
// below, once the transaction has fully settled and the rollback (if any)
// has completed.
export function createTaskFromIssueData(
  issue: GithubIssueData,
  options?: { projectId?: string | null },
): ResultAsync<{ task: TaskRow; link: LinkRow }, LinkConflictError> {
  let insertedTaskId: string | undefined

  return ResultAsync.fromPromise<{ task: TaskRow; link: LinkRow }, unknown>(
    db.transaction(async (tx) => {
      const taskResult = firstOrErr(
        await tx
          .insert(tasks)
          .values({
            title: issue.title,
            description: issue.body,
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
          .values({
            taskId: task.id,
            owner: issue.owner,
            repo: issue.repo,
            number: issue.number,
            kind: issue.kind,
            url: issue.url,
            state: issue.state,
            title: issue.title,
            body: issue.body,
          })
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
// together: a bare insertLink followed by a separate recordGithubLinked
// write would leave the timeline missing an entry if the process crashes (or
// the write fails) between the two. The GitHub API fetch happens before the
// transaction opens since it can't participate in it.
//
// insertLink's own try/catch can't be relied on to keep the transaction
// alive on conflict: postgres.js marks the whole transaction failed as soon
// as any query on it rejects, even one the immediate caller catches (see
// https://github.com/porsager/postgres#transactions — `scope()` tracks each
// query's rejection independently of the callback's own try/catch and
// rethrows it once the callback settles). So a conflict is rethrown here to
// trigger that rollback, then reclassified in `.orElse`, once the
// transaction has fully settled — the same boundary createTaskFromIssueData
// uses.
export function linkTaskToGithubUrl(
  taskId: string,
  ref: GithubResourceRef,
  author: EditAuthor,
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
            const linkResult = await insertLink(tx, taskId, ref, issue)
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

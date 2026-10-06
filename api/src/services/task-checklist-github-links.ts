import { eq } from 'drizzle-orm'
import { errAsync, okAsync, type Result, ResultAsync } from 'neverthrow'

import { db } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import { GithubApiError } from '#integrations/github/index'
import {
  fetchGithubIssue,
  type GithubIssueData,
  GithubPullRequestRequiredError,
  type GithubResourceRef,
  InvalidGithubUrlError,
  parseGithubPullRequestUrl,
} from '#integrations/github/issues'
import { RowNotFoundError } from '#lib/drizzle-utils'
import type { EditAuthor } from '#lib/edits'
import {
  createChecklistItemWithGithubLink,
  updateChecklistItemWithGithubLink,
} from '#services/task-checklist-items'
import {
  classifyGithubLinkConflict,
  GithubResourceAlreadyLinkedError,
} from '#services/task-github-links'

type ChecklistItem = typeof taskChecklistItems.$inferSelect
type ChecklistWriteError = { status: 400 | 404; message: string }
type GithubItemError =
  ChecklistWriteError | GithubResourceAlreadyLinkedError | Error

type GithubFetchError =
  | InvalidGithubUrlError
  | GithubPullRequestRequiredError
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError

function isChecklistWriteError(cause: unknown): cause is ChecklistWriteError {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'status' in cause &&
    (cause.status === 400 || cause.status === 404) &&
    'message' in cause &&
    typeof cause.message === 'string'
  )
}

function fetchPullRequest(
  url: string,
): ResultAsync<GithubIssueData, GithubFetchError> {
  return parseGithubPullRequestUrl(url)
    .asyncAndThen(fetchGithubIssue)
    .andThen((issue) =>
      issue.kind === 'pull_request'
        ? okAsync(issue)
        : errAsync(new GithubPullRequestRequiredError()),
    )
}

function linkTransaction<T>(
  taskId: string,
  ref: GithubResourceRef,
  transaction: Promise<Result<T, GithubItemError>>,
): ResultAsync<T, GithubItemError> {
  return ResultAsync.fromPromise(transaction, (cause) => cause)
    .andThen((result) =>
      result.isErr()
        ? errAsync<T, GithubItemError>(result.error)
        : okAsync<T, GithubItemError>(result.value),
    )
    .orElse((cause) => {
      if (
        cause instanceof GithubResourceAlreadyLinkedError ||
        cause instanceof RowNotFoundError ||
        isChecklistWriteError(cause)
      ) {
        return errAsync(cause)
      }

      return ResultAsync.fromSafePromise(
        classifyGithubLinkConflict(cause, taskId, ref),
      ).andThen((result) => result)
    })
}

export function createChecklistItemWithGithubUrl(
  checklistId: string,
  input: {
    content: string
    note?: string | null | undefined
    parentItemId?: string | null | undefined
    sortOrder?: number | undefined
  },
  githubUrl: string,
  author: EditAuthor,
): ResultAsync<ChecklistItem, GithubItemError | GithubFetchError> {
  return ResultAsync.fromSafePromise(
    db
      .select({ taskId: taskChecklists.taskId })
      .from(taskChecklists)
      .where(eq(taskChecklists.id, checklistId))
      .then((rows) => rows[0]),
  ).andThen((checklist) => {
    if (checklist == null) {
      return errAsync<ChecklistItem, GithubItemError>({
        status: 404,
        message: 'Checklist not found',
      })
    }

    return fetchPullRequest(githubUrl).andThen((issue) =>
      linkTransaction<ChecklistItem>(
        checklist.taskId,
        issue,
        db.transaction((tx) =>
          createChecklistItemWithGithubLink(
            tx,
            checklistId,
            input,
            issue,
            author,
          ),
        ),
      ),
    )
  })
}

export function updateChecklistItemWithGithubUrl(
  itemId: string,
  input: {
    content?: string | undefined
    note?: string | null | undefined
  },
  githubUrl: string,
  author: EditAuthor,
): ResultAsync<ChecklistItem, GithubItemError | GithubFetchError> {
  return ResultAsync.fromSafePromise(
    db
      .select({ taskId: taskChecklists.taskId })
      .from(taskChecklistItems)
      .innerJoin(
        taskChecklists,
        eq(taskChecklists.id, taskChecklistItems.checklistId),
      )
      .where(eq(taskChecklistItems.id, itemId))
      .limit(1)
      .then((rows) => rows[0]),
  ).andThen((target) => {
    if (target == null) {
      return errAsync<ChecklistItem, GithubItemError>({
        status: 404,
        message: 'Checklist item not found',
      })
    }

    return fetchPullRequest(githubUrl).andThen((issue) =>
      linkTransaction<ChecklistItem>(
        target.taskId,
        issue,
        db.transaction((tx) =>
          updateChecklistItemWithGithubLink(tx, itemId, input, issue, author),
        ),
      ),
    )
  })
}

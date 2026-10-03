import { and, eq, inArray, sql } from 'drizzle-orm'
import { errAsync, okAsync, ResultAsync } from 'neverthrow'

import { db, type DbTransaction } from '#db/connection'
import { defaultGithubNotifyEvents, taskGithubLinks } from '#db/schema'
import type {
  IntegrationConfigError,
  OAuthTokenMissingError,
  TokenRefreshError,
} from '#integrations/errors'
import type { GithubApiError } from '#integrations/github/index'
import {
  fetchGithubIssue,
  type GithubIssueData,
  type GithubResourceRef,
  InvalidGithubUrlError,
  parseGithubIssueUrl,
} from '#integrations/github/issues'

type LinkRow = typeof taskGithubLinks.$inferSelect
type Executor = typeof db | DbTransaction

export interface GithubBlockerRef {
  owner: string
  repo: string
  number: number
  url: string
}

export interface PreparedGithubBlockers {
  refs: GithubResourceRef[]
  newIssues: GithubIssueData[]
}

export class GithubBlockerSubjectConflictError extends Error {
  constructor() {
    super(
      'This GitHub issue or pull request is already linked to this task as a subject',
    )
    this.name = 'GithubBlockerSubjectConflictError'
  }
}

export async function lockTaskGithubLinks(
  tx: DbTransaction,
  taskId: string,
): Promise<void> {
  await tx.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext('task_github_links:' || ${taskId}))`,
  )
}

type PrepareGithubBlockersError =
  | InvalidGithubUrlError
  | GithubBlockerSubjectConflictError
  | GithubApiError
  | OAuthTokenMissingError
  | IntegrationConfigError
  | TokenRefreshError

function githubRefKey(ref: GithubResourceRef): string {
  return `${ref.owner}/${ref.repo}#${String(ref.number)}`
}

function linkRefKey(link: Pick<LinkRow, 'owner' | 'repo' | 'number'>): string {
  return githubRefKey(link)
}

function uniqueGithubRefs(
  urls: string[],
): { refs: GithubResourceRef[] } | { error: InvalidGithubUrlError } {
  const refs = new Map<string, GithubResourceRef>()
  for (const url of urls) {
    const result = parseGithubIssueUrl(url)
    if (result.isErr()) return { error: result.error }
    refs.set(githubRefKey(result.value), result.value)
  }
  return { refs: [...refs.values()] }
}

// Fetch only new links. Existing blocker rows remain untouched so their IDs
// and per-link notification preferences survive a full replacement PATCH.
export function prepareGithubBlockers(
  taskId: string | undefined,
  urls: string[],
): ResultAsync<PreparedGithubBlockers, PrepareGithubBlockersError> {
  const parsed = uniqueGithubRefs(urls)
  if ('error' in parsed) return errAsync(parsed.error)

  const refs = parsed.refs
  const existingLinksPromise =
    taskId == null || refs.length === 0
      ? Promise.resolve([] as LinkRow[])
      : db
          .select()
          .from(taskGithubLinks)
          .where(eq(taskGithubLinks.taskId, taskId))

  return ResultAsync.fromSafePromise(existingLinksPromise).andThen(
    (existingLinks) => {
      const desiredKeys = new Set(refs.map(githubRefKey))
      const subjectConflict = existingLinks.some(
        (link) => link.role === 'subject' && desiredKeys.has(linkRefKey(link)),
      )
      if (subjectConflict) {
        return errAsync(new GithubBlockerSubjectConflictError())
      }

      const existingBlockerKeys = new Set(
        existingLinks.filter((link) => link.role === 'blocker').map(linkRefKey),
      )
      return refs
        .filter((ref) => !existingBlockerKeys.has(githubRefKey(ref)))
        .reduce<ResultAsync<GithubIssueData[], PrepareGithubBlockersError>>(
          (result, ref) =>
            result.andThen((issues) =>
              fetchGithubIssue(ref).map((issue) => [...issues, issue]),
            ),
          okAsync<GithubIssueData[], PrepareGithubBlockersError>([]),
        )
        .map((newIssues) => ({ refs, newIssues }))
    },
  )
}

function blockerLinkInsertValues(
  taskId: string,
  issue: GithubIssueData,
): typeof taskGithubLinks.$inferInsert {
  return {
    taskId,
    owner: issue.owner,
    repo: issue.repo,
    number: issue.number,
    role: 'blocker',
    notifyEvents: defaultGithubNotifyEvents('blocker'),
    kind: issue.kind,
    url: issue.url,
    state: issue.state,
    title: issue.title,
    commentsCount: issue.commentsCount,
    githubUpdatedAt: new Date(issue.githubUpdatedAt),
    stateReason: issue.stateReason,
  }
}

export async function insertTaskGithubBlockers(
  tx: DbTransaction,
  taskId: string,
  issues: GithubIssueData[],
): Promise<void> {
  if (issues.length === 0) return

  await tx
    .insert(taskGithubLinks)
    .values(issues.map((issue) => blockerLinkInsertValues(taskId, issue)))
}

export async function replaceTaskGithubBlockers(
  tx: DbTransaction,
  taskId: string,
  prepared: PreparedGithubBlockers,
): Promise<'ok' | 'subject-conflict'> {
  await lockTaskGithubLinks(tx, taskId)

  const existingLinks = await tx
    .select()
    .from(taskGithubLinks)
    .where(eq(taskGithubLinks.taskId, taskId))
  const desiredKeys = new Set(prepared.refs.map(githubRefKey))

  if (
    existingLinks.some(
      (link) => link.role === 'subject' && desiredKeys.has(linkRefKey(link)),
    )
  ) {
    return 'subject-conflict'
  }

  const retainedBlockerKeys = new Set(
    existingLinks
      .filter(
        (link) => link.role === 'blocker' && desiredKeys.has(linkRefKey(link)),
      )
      .map(linkRefKey),
  )
  const removedIds = existingLinks
    .filter(
      (link) => link.role === 'blocker' && !desiredKeys.has(linkRefKey(link)),
    )
    .map((link) => link.id)
  if (removedIds.length > 0) {
    await tx
      .delete(taskGithubLinks)
      .where(inArray(taskGithubLinks.id, removedIds))
  }

  const newIssues = prepared.newIssues.filter(
    (issue) => !retainedBlockerKeys.has(githubRefKey(issue)),
  )
  await insertTaskGithubBlockers(tx, taskId, newIssues)

  return 'ok'
}

export async function getTaskGithubBlockers(
  taskId: string,
): Promise<LinkRow[]> {
  return db
    .select()
    .from(taskGithubLinks)
    .where(
      and(
        eq(taskGithubLinks.taskId, taskId),
        eq(taskGithubLinks.role, 'blocker'),
      ),
    )
    .orderBy(taskGithubLinks.createdAt, taskGithubLinks.seq)
}

export async function getOpenGithubBlockerRefsByTaskId(
  taskIds: string[],
): Promise<Map<string, GithubBlockerRef[]>> {
  if (taskIds.length === 0) return new Map()

  const rows = await db
    .select({
      taskId: taskGithubLinks.taskId,
      owner: taskGithubLinks.owner,
      repo: taskGithubLinks.repo,
      number: taskGithubLinks.number,
      url: taskGithubLinks.url,
    })
    .from(taskGithubLinks)
    .where(
      and(
        inArray(taskGithubLinks.taskId, taskIds),
        eq(taskGithubLinks.role, 'blocker'),
        eq(taskGithubLinks.state, 'open'),
      ),
    )
    .orderBy(
      taskGithubLinks.owner,
      taskGithubLinks.repo,
      taskGithubLinks.number,
    )

  const result = new Map<string, GithubBlockerRef[]>()
  for (const row of rows) {
    const refs = result.get(row.taskId) ?? []
    refs.push({
      owner: row.owner,
      repo: row.repo,
      number: row.number,
      url: row.url,
    })
    result.set(row.taskId, refs)
  }
  return result
}

export async function getIncompleteGithubBlockerRefs(
  taskId: string,
  executor: Executor,
): Promise<GithubBlockerRef[]> {
  return executor
    .select({
      owner: taskGithubLinks.owner,
      repo: taskGithubLinks.repo,
      number: taskGithubLinks.number,
      url: taskGithubLinks.url,
    })
    .from(taskGithubLinks)
    .where(
      and(
        eq(taskGithubLinks.taskId, taskId),
        eq(taskGithubLinks.role, 'blocker'),
        eq(taskGithubLinks.state, 'open'),
      ),
    )
    .orderBy(
      taskGithubLinks.owner,
      taskGithubLinks.repo,
      taskGithubLinks.number,
    )
}

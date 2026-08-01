import { db, type DbTransaction } from '#db/connection'
import { taskEvents } from '#db/schema'
import type { EditAuthor } from '#lib/edits'

export type TaskStatus = 'todo' | 'in_progress' | 'completed'
export type GithubLinkKind = 'issue' | 'pull_request'

export type GithubLinkRef = {
  owner: string
  repo: string
  number: number
  kind: GithubLinkKind
}

// Accepted by every recordXxx below so callers can either run inside an
// existing transaction (status changes, alongside the task update) or write
// standalone against `db` (GitHub link/unlink, which has no surrounding
// transaction to join).
type Executor = typeof db | DbTransaction

/** Records a task's status transition. Always insert-only, no aggregation. */
export async function recordStatusChanged(
  executor: Executor,
  taskId: string,
  fromStatus: TaskStatus,
  toStatus: TaskStatus,
  author: EditAuthor,
): Promise<void> {
  await executor.insert(taskEvents).values({
    taskId,
    type: 'status_changed',
    fromStatus,
    toStatus,
    authorKind: author.kind,
    authorAgent: author.agent,
  })
}

async function recordGithubLinkEvent(
  executor: Executor,
  taskId: string,
  type: 'github_linked' | 'github_unlinked',
  link: GithubLinkRef,
  author: EditAuthor,
): Promise<void> {
  await executor.insert(taskEvents).values({
    taskId,
    type,
    githubOwner: link.owner,
    githubRepo: link.repo,
    githubNumber: link.number,
    githubKind: link.kind,
    authorKind: author.kind,
    authorAgent: author.agent,
  })
}

export function recordGithubLinked(
  executor: Executor,
  taskId: string,
  link: GithubLinkRef,
  author: EditAuthor,
): Promise<void> {
  return recordGithubLinkEvent(executor, taskId, 'github_linked', link, author)
}

export function recordGithubUnlinked(
  executor: Executor,
  taskId: string,
  link: GithubLinkRef,
  author: EditAuthor,
): Promise<void> {
  return recordGithubLinkEvent(
    executor,
    taskId,
    'github_unlinked',
    link,
    author,
  )
}

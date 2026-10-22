import type { DbTransaction } from '#db/connection'
import { taskRelations } from '#db/schema'
import { findTaskByIdOrNumber } from '#routes/tasks/shared'
import type { DuplicateTaskSummary } from '#schemas/webhook'
import {
  getIncompleteGithubBlockerRefs,
  type GithubBlockerRef,
} from '#services/task-github-blockers'
import { getIncompleteBlockerNumbers } from '#services/task-relations'
import {
  getIncompleteTaskWaits,
  type TaskWaitSummary,
} from '#services/task-waits'

// Both close-as-duplicate routes need the target UUID for self-reference
// checks and relation writes.
export async function resolveDuplicateTarget(
  id: string,
  duplicateOfTaskId: string | number,
): Promise<
  | { target: DuplicateTaskSummary }
  | { error: { body: { error: string }; status: 400 | 404 } }
> {
  const duplicateTarget = await findTaskByIdOrNumber(String(duplicateOfTaskId))
  if (!duplicateTarget) {
    return {
      error: {
        body: { error: 'Duplicate target task not found' },
        status: 404,
      },
    }
  }

  if (duplicateTarget.id === id) {
    return {
      error: {
        body: { error: 'A task cannot be a duplicate of itself' },
        status: 400,
      },
    }
  }

  return {
    target: {
      id: duplicateTarget.id,
      number: duplicateTarget.number,
      title: duplicateTarget.title,
    },
  }
}

// Must run against the same `tx` as the status update it gates.
export async function checkNotBlocked(
  tx: DbTransaction,
  id: string,
): Promise<{
  body: {
    error: string
    blockedByNumbers: number[]
    blockedByGithubRefs: GithubBlockerRef[]
    blockedByWaits?: TaskWaitSummary[]
  }
  status: 409
} | null> {
  const [blockedByNumbers, blockedByGithubRefs, blockedByWaits] =
    await Promise.all([
      getIncompleteBlockerNumbers(id, tx),
      getIncompleteGithubBlockerRefs(id, tx),
      getIncompleteTaskWaits(id, tx),
    ])
  if (
    blockedByNumbers.length === 0 &&
    blockedByGithubRefs.length === 0 &&
    blockedByWaits.length === 0
  ) {
    return null
  }

  const blockerNames = [
    ...blockedByNumbers.map((number) => `#${String(number)}`),
    ...blockedByGithubRefs.map(
      ({ owner, repo, number }) => `${owner}/${repo}#${String(number)}`,
    ),
    ...blockedByWaits.map(({ id: waitId, label }) => `wait ${label || waitId}`),
  ]

  return {
    body: {
      error: `Task is blocked by unresolved blockers: ${blockerNames.join(', ')}`,
      blockedByNumbers,
      blockedByGithubRefs,
      ...(blockedByWaits.length > 0 ? { blockedByWaits } : {}),
    },
    status: 409,
  }
}

// `onConflictDoNothing` makes re-closing a task as a duplicate of the same
// target (its primary key) idempotent instead of erroring.
export async function insertDuplicateOfRelation(
  tx: DbTransaction,
  sourceTaskId: string,
  targetTaskId: string,
) {
  await tx
    .insert(taskRelations)
    .values({ sourceTaskId, targetTaskId, type: 'duplicate_of' })
    .onConflictDoNothing()
}

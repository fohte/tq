import { taskIdOrNumber } from '#lib/numeric-id'
import { resolveTasksByIdsOrNumbers } from '#routes/tasks/shared'
import {
  type PreparedGithubBlockers,
  prepareGithubBlockers,
} from '#services/task-github-blockers'

type TaskBlockerResolution = {
  targetIds: string[]
  githubBlockers: PreparedGithubBlockers
}

type TaskBlockerResolutionError =
  | { error: { body: { error: string }; status: 400 | 404 } }
  | { githubError: Error }

type TaskReferenceResolution =
  | { targetIds: string[] }
  | { error: { body: { error: string }; status: 400 | 404 } }

type TaskReferenceResolver = (
  references: string[],
) => Promise<TaskReferenceResolution>

export function splitBlockedByInputs(blockedBy: (string | number)[]): {
  taskReferences: string[]
  githubUrls: string[]
} {
  const taskReferences: string[] = []
  const githubUrls: string[] = []

  for (const value of blockedBy) {
    const raw = String(value)
    if (taskIdOrNumber.safeParse(value).success) {
      taskReferences.push(raw)
    } else {
      githubUrls.push(raw)
    }
  }

  return { taskReferences, githubUrls }
}

// Existence is a cheap, non-racy check -- the cycle check needs the
// transactional lock in `syncTaskBlockedBy` instead.
export async function resolveBlockedByExistence(
  blockedBy: string[],
): Promise<
  { targetIds: string[] } | { error: { body: { error: string }; status: 404 } }
> {
  const uniqueRaw = [...new Set(blockedBy)]
  if (uniqueRaw.length === 0) return { targetIds: [] }

  const { byParam: resolved, ids: targetIds } =
    await resolveTasksByIdsOrNumbers(uniqueRaw)
  const missing = uniqueRaw.filter((raw) => !resolved.has(raw))
  if (missing.length > 0) {
    return {
      error: { body: { error: 'Blocking task not found' }, status: 404 },
    }
  }

  return { targetIds }
}

// Self-reference is checked first, against the raw input, so it never costs a
// DB round trip and always wins over an existence error when a request
// combines its own id/number with an unrelated missing blocker.
export async function resolveBlockedByTargets(
  task: { id: string; number: number },
  blockedBy: string[],
): Promise<
  | { targetIds: string[] }
  | { error: { body: { error: string }; status: 400 | 404 } }
> {
  if (blockedBy.includes(task.id) || blockedBy.includes(String(task.number))) {
    return {
      error: {
        body: { error: 'A task cannot be blocked by itself' },
        status: 400,
      },
    }
  }

  return resolveBlockedByExistence(blockedBy)
}

async function resolveBlockedByInputs(
  blockedBy: (string | number)[],
  taskId: string | undefined,
  resolveTaskReferences: TaskReferenceResolver,
): Promise<TaskBlockerResolution | TaskBlockerResolutionError> {
  const { taskReferences, githubUrls } = splitBlockedByInputs(blockedBy)
  const taskResult = await resolveTaskReferences(taskReferences)
  if ('error' in taskResult) return taskResult

  const githubResult = await prepareGithubBlockers(taskId, githubUrls)
  if (githubResult.isErr()) return { githubError: githubResult.error }

  return {
    targetIds: taskResult.targetIds,
    githubBlockers: githubResult.value,
  }
}

export function resolveCreateBlockedByInputs(
  blockedBy: (string | number)[],
): Promise<TaskBlockerResolution | TaskBlockerResolutionError> {
  return resolveBlockedByInputs(blockedBy, undefined, resolveBlockedByExistence)
}

export function resolveUpdateBlockedByInputs(
  task: { id: string; number: number },
  blockedBy: (string | number)[],
): Promise<TaskBlockerResolution | TaskBlockerResolutionError> {
  return resolveBlockedByInputs(blockedBy, task.id, (references) =>
    resolveBlockedByTargets(task, references),
  )
}

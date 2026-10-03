import { z } from 'zod'

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

export function splitBlockedByInputs(blockedBy: (string | number)[]): {
  taskReferences: string[]
  githubUrls: string[]
} {
  const taskReferences: string[] = []
  const githubUrls: string[] = []

  for (const value of blockedBy) {
    const raw = String(value)
    if (
      typeof value === 'number' ||
      /^\d+$/.test(raw) ||
      z.uuid().safeParse(raw).success
    ) {
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

export async function resolveCreateBlockedByInputs(
  blockedBy: (string | number)[],
): Promise<TaskBlockerResolution | TaskBlockerResolutionError> {
  const { taskReferences, githubUrls } = splitBlockedByInputs(blockedBy)
  const taskResult = await resolveBlockedByExistence(taskReferences)
  if ('error' in taskResult) return taskResult

  const githubResult = await prepareGithubBlockers(undefined, githubUrls)
  if (githubResult.isErr()) return { githubError: githubResult.error }

  return {
    targetIds: taskResult.targetIds,
    githubBlockers: githubResult.value,
  }
}

export async function resolveUpdateBlockedByInputs(
  task: { id: string; number: number },
  blockedBy: (string | number)[],
): Promise<TaskBlockerResolution | TaskBlockerResolutionError> {
  const { taskReferences, githubUrls } = splitBlockedByInputs(blockedBy)
  const taskResult = await resolveBlockedByTargets(task, taskReferences)
  if ('error' in taskResult) return taskResult

  const githubResult = await prepareGithubBlockers(task.id, githubUrls)
  if (githubResult.isErr()) return { githubError: githubResult.error }

  return {
    targetIds: taskResult.targetIds,
    githubBlockers: githubResult.value,
  }
}

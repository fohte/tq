import { resolveTasksByIdsOrNumbers } from '#routes/tasks/shared'

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

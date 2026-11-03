import type { z } from 'zod'

import { commitmentEnum } from '#schemas/task'

export type TaskCommitment = z.infer<typeof commitmentEnum>

export function resolvePriorityInput({
  priority,
  commitment,
  currentPriority = null,
}: {
  priority: number | null | undefined
  commitment: TaskCommitment | undefined
  currentPriority?: number | null
}): number | null | undefined {
  if (priority !== undefined) return priority
  if (commitment === undefined) return undefined
  return priorityForCommitment(commitment, currentPriority)
}

export function commitmentForPriority(priority: number | null): TaskCommitment {
  if (priority === null) return 'inbox'
  if (priority === -1) return 'someday'
  return 'active'
}

export function priorityForCommitment(
  commitment: TaskCommitment,
  currentPriority: number | null = null,
): number | null {
  switch (commitment) {
    case 'inbox':
      return null
    case 'someday':
      return -1
    case 'active':
      return currentPriority === null || currentPriority === -1
        ? 0
        : currentPriority
  }
}

import type { LinkedTask } from '#background'

export function makeLinkedTask(
  overrides: Partial<LinkedTask> = {},
): LinkedTask {
  return {
    id: 'uuid-1',
    number: 42,
    ...overrides,
  }
}

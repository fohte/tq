import type { Queue } from '#hooks/use-queues'

export function makeQueue(overrides: Partial<Queue> = {}): Queue {
  return {
    key: 'day',
    name: 'Today',
    periodUnit: 'day',
    position: 0,
    ...overrides,
  }
}

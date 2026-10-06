import type { Queue } from '#hooks/use-queues'

export function makeQueue(overrides: Partial<Queue> = {}): Queue {
  return {
    key: 'queue-sample',
    name: 'Sample queue',
    periodUnit: 'day',
    position: 0,
    ...overrides,
  }
}

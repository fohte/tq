import type { PrioritySetting } from '#hooks/use-priority-settings'

export function makePrioritySettings(): PrioritySetting[] {
  return [
    { priority: 2, name: 'Now', description: '', sortOrder: 0 },
    { priority: 1, name: 'Next', description: '', sortOrder: 1 },
    { priority: 0, name: 'Normal', description: '', sortOrder: 2 },
    { priority: null, name: 'Inbox', description: '', sortOrder: 3 },
    { priority: -1, name: 'Later', description: '', sortOrder: 4 },
  ]
}

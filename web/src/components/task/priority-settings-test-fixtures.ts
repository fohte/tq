import type { PrioritySetting } from '#hooks/use-priority-settings'

const settingDefaults = {
  2: 'Now',
  1: 'Next',
  0: 'Normal',
  inbox: 'Inbox',
  '-1': 'Later',
} satisfies Record<'-1' | '0' | '1' | '2' | 'inbox', string>

export function makePrioritySettings(): PrioritySetting[] {
  return [
    { priority: 2, name: settingDefaults['2'], description: '', sortOrder: 0 },
    { priority: 1, name: settingDefaults['1'], description: '', sortOrder: 1 },
    { priority: 0, name: settingDefaults['0'], description: '', sortOrder: 2 },
    {
      priority: null,
      name: settingDefaults.inbox,
      description: '',
      sortOrder: 3,
    },
    {
      priority: -1,
      name: settingDefaults['-1'],
      description: '',
      sortOrder: 4,
    },
  ]
}

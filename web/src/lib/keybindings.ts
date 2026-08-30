export interface Keybinding {
  id: string
  keys: string
  description: string
}

type NavRoutePath = '/today' | '/' | '/tasks' | '/projects' | '/settings'

export interface NavKeybinding extends Keybinding {
  to: NavRoutePath
}

export const searchKeybinding: Keybinding = {
  id: 'search',
  keys: '⌘K',
  description: 'search tasks',
}

export const newTaskKeybinding: Keybinding = {
  id: 'new-task',
  keys: 'n',
  description: 'new task',
}

export const navKeybindings = {
  goToToday: {
    id: 'go-to-today',
    keys: 'g d',
    to: '/today',
    description: 'go to today',
  },
  goToCalendar: {
    id: 'go-to-calendar',
    keys: 'g c',
    to: '/',
    description: 'go to calendar',
  },
  goToTasks: {
    id: 'go-to-tasks',
    keys: 'g t',
    to: '/tasks',
    description: 'go to tasks',
  },
  goToProjects: {
    id: 'go-to-projects',
    keys: 'g p',
    to: '/projects',
    description: 'go to projects',
  },
  goToSettings: {
    id: 'go-to-settings',
    keys: 'g s',
    to: '/settings',
    description: 'go to settings',
  },
} as const satisfies Record<string, NavKeybinding>

// Display order for the settings keybindings list; mirrors the sidebar's nav order
// (navKeybindings' key insertion order matches it, so Object.values needs no sort).
export const allKeybindings: Keybinding[] = [
  searchKeybinding,
  newTaskKeybinding,
  ...Object.values(navKeybindings),
]

import type { MenuItemConstructorOptions, WebContents } from 'electron'

export type NavigationHistory = Pick<
  WebContents['navigationHistory'],
  'canGoBack' | 'goBack' | 'canGoForward' | 'goForward'
>

type HistoryItem = {
  label: string
  accelerator: string
  click: () => void
}

export const historyItems = (history: NavigationHistory): HistoryItem[] => [
  {
    label: 'Back',
    accelerator: 'CmdOrCtrl+[',
    click: () => {
      if (history.canGoBack()) history.goBack()
    },
  },
  {
    label: 'Forward',
    accelerator: 'CmdOrCtrl+]',
    click: () => {
      if (history.canGoForward()) history.goForward()
    },
  },
]

// The window has no browser chrome, so the menu is the only place to put the
// history shortcuts. Setting a menu replaces Electron's default one, so the
// standard roles are listed again to keep clipboard, reload, etc. working.
export const buildMenuTemplate = (
  history: NavigationHistory,
): MenuItemConstructorOptions[] => [
  { role: 'appMenu' },
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { label: 'History', submenu: historyItems(history) },
  { role: 'windowMenu' },
]

import type { MenuItemConstructorOptions, WebContents } from 'electron'

export type NavigationHistory = Pick<
  WebContents['navigationHistory'],
  'canGoBack' | 'goBack' | 'canGoForward' | 'goForward'
>

type ShortcutItem = {
  label: string
  accelerator: string
  click: () => void
}

type CurrentPage = Pick<WebContents, 'getURL'>

type ClipboardWriter = {
  writeText: (text: string) => void
}

export const historyItems = (history: NavigationHistory): ShortcutItem[] => [
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

export const pageItems = (
  webContents: CurrentPage,
  clipboard: ClipboardWriter,
): ShortcutItem[] => [
  {
    label: 'Copy URL',
    accelerator: 'CmdOrCtrl+Shift+C',
    click: () => {
      clipboard.writeText(webContents.getURL())
    },
  },
]

// The window has no browser chrome, so the menu is the only place to put the
// history shortcuts. Setting a menu replaces Electron's default one, so the
// standard roles are listed again to keep clipboard, reload, etc. working.
export const buildMenuTemplate = (
  history: NavigationHistory,
  webContents: CurrentPage,
  clipboard: ClipboardWriter,
) =>
  [
    { role: 'appMenu' },
    { role: 'fileMenu' },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { label: 'Page', submenu: pageItems(webContents, clipboard) },
    { label: 'History', submenu: historyItems(history) },
    { role: 'windowMenu' },
  ] satisfies MenuItemConstructorOptions[]

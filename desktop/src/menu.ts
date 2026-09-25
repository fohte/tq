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

type CurrentPage = Pick<WebContents, 'executeJavaScript' | 'getURL'>

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
      const url = webContents.getURL()
      clipboard.writeText(url)
      void webContents
        .executeJavaScript(
          `window.dispatchEvent(new CustomEvent('tq:url-copied', { detail: { url: ${JSON.stringify(url)} } }))`,
        )
        .catch((caughtErr: unknown) => {
          console.error('failed to show the URL copied toast', caughtErr)
        })
    },
  },
]

// The window has no browser chrome, so history and page URL shortcuts live in
// the menu. Setting a menu replaces Electron's default one, so the standard
// roles are listed again to keep clipboard, reload, etc. working.
export const buildMenuTemplate = (
  history: NavigationHistory,
  webContents: CurrentPage,
  clipboard: ClipboardWriter,
): MenuItemConstructorOptions[] => [
  { role: 'appMenu' },
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { label: 'Page', submenu: pageItems(webContents, clipboard) },
  { label: 'History', submenu: historyItems(history) },
  { role: 'windowMenu' },
]

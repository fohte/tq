import type {
  MenuItem,
  MenuItemConstructorOptions,
  WebContents,
} from 'electron'

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

type MenuTemplateItem = Omit<
  MenuItemConstructorOptions,
  'click' | 'submenu'
> & {
  click?: (menuItem: Pick<MenuItem, 'checked'>) => void
  submenu?: MenuTemplateItem[]
}

export type SideWindowMenuActions = {
  open: () => void
  alwaysOnTop: boolean
  setAlwaysOnTop: (alwaysOnTop: boolean) => void
}

const historyItems = (history: NavigationHistory): ShortcutItem[] => [
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

const pageItems = (
  webContents: CurrentPage,
  clipboard: ClipboardWriter,
): ShortcutItem[] => [
  {
    label: 'Find…',
    accelerator: 'CmdOrCtrl+F',
    click: () => {
      void webContents
        .executeJavaScript(`window.dispatchEvent(new CustomEvent('tq:find'))`)
        .catch((caughtErr: unknown) => {
          console.error('failed to open the find bar', caughtErr)
        })
    },
  },
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
  sideWindow: SideWindowMenuActions,
): MenuTemplateItem[] => [
  { role: 'appMenu' },
  { role: 'fileMenu' },
  { role: 'editMenu' },
  { role: 'viewMenu' },
  { label: 'Page', submenu: pageItems(webContents, clipboard) },
  { label: 'History', submenu: historyItems(history) },
  {
    label: 'Window',
    submenu: [
      {
        label: 'Open Side Window',
        click: () => {
          sideWindow.open()
        },
      },
      {
        label: 'Keep Side Window on Top',
        type: 'checkbox',
        checked: sideWindow.alwaysOnTop,
        click: (menuItem) => {
          sideWindow.setAlwaysOnTop(menuItem.checked)
        },
      },
      { type: 'separator' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' },
      { type: 'separator' },
      { role: 'window' },
    ],
  },
]

import { join } from 'node:path'

import {
  app,
  BrowserWindow,
  clipboard,
  globalShortcut,
  Menu,
  screen,
  shell,
} from 'electron'
import { ResultAsync } from 'neverthrow'

import { EXTERNAL_SCHEMES, TQ_ORIGIN } from '#config'
import { createJsonFileStorage } from '#json-store'
import { buildMenuTemplate } from '#menu'
import {
  classifyNavigation,
  DEEP_LINK_SCHEME,
  type NavigationSource,
  resolveDeepLink,
  shouldOpenSideNavigationInMain,
} from '#navigation'
import {
  createSideWindowSettingsStore,
  type SideWindowSettingsStore,
} from '#side-window-settings'
import {
  clampWindowBounds,
  createDebouncedAction,
  createWindowBoundsStore,
  initialWindowBounds,
} from '#window-state'
import { setSideWindowTitle } from '#window-title'

let isQuitting = false
let mainWindow: BrowserWindow | undefined
let sideWindow: BrowserWindow | undefined
let memoWindow: BrowserWindow | undefined
let flushSideWindowBounds: (() => void) | undefined
let sideWindowAlwaysOnTop = false
let sideWindowSettingsStore: SideWindowSettingsStore | undefined
// A deep link can arrive before the window exists (cold start from a link).
let pendingUrl: string | undefined

const SIDE_WINDOW_URL = `${TQ_ORIGIN.replace(/\/+$/, '')}/?layout=compact`
const MEMO_WINDOW_URL = `${TQ_ORIGIN.replace(/\/+$/, '')}/memo?layout=compact`
const isMacOS = process.platform === 'darwin'

const createDesktopWindow = (
  options: Electron.BrowserWindowConstructorOptions,
) => {
  const win = new BrowserWindow({
    ...options,
    ...(isMacOS ? { titleBarStyle: 'hidden' as const } : {}),
  })

  if (isMacOS) {
    win.webContents.setUserAgent(`${win.webContents.getUserAgent()} TQDesktop`)
  }

  return win
}

// Both `loadURL` and `shell.openExternal` can reject; there is no caller to
// hand the error to, so log it.
const logRejection = (promise: Promise<unknown>, message: string) =>
  ResultAsync.fromPromise(promise, (caughtErr) => caughtErr).match(
    () => undefined,
    (caughtErr) => {
      console.error(message, caughtErr)
    },
  )

const openExternal = (url: string) =>
  logRejection(
    shell.openExternal(url),
    `failed to open ${url} in the default browser`,
  )

const hideOnCloseUnlessQuitting = (
  win: BrowserWindow,
  beforeHide?: () => void,
) => {
  win.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    beforeHide?.()
    win.hide()
  })
}

const openMainWindow = (url: string) => {
  if (mainWindow === undefined || mainWindow.isDestroyed()) return

  void logRejection(mainWindow.loadURL(url), `failed to load ${url}`)
  showWindow(mainWindow)
}

const createWindow = (url: string): BrowserWindow => {
  const win = createDesktopWindow({
    // The sidebar provides the main window's titlebar spacing and drag region.
    ...(isMacOS ? { minWidth: 768 } : {}),
    webPreferences: { sandbox: true },
  })

  // Hide instead of closing so that reopening from the Dock keeps the page
  // state; `before-quit` lets a real quit through.
  hideOnCloseUnlessQuitting(win)

  void logRejection(win.loadURL(url), `failed to load ${url}`)

  return win
}

const showWindow = (win: BrowserWindow) => {
  app.show()
  win.show()
}

const isMissingFile = (caughtErr: unknown): boolean =>
  typeof caughtErr === 'object' &&
  caughtErr !== null &&
  'code' in caughtErr &&
  caughtErr.code === 'ENOENT'

const setSideWindowAlwaysOnTop = (alwaysOnTop: boolean) => {
  sideWindowAlwaysOnTop = alwaysOnTop
  if (sideWindow !== undefined && !sideWindow.isDestroyed()) {
    sideWindow.setAlwaysOnTop(alwaysOnTop)
  }

  sideWindowSettingsStore?.save({ alwaysOnTop }).match(
    () => undefined,
    (caughtErr) => {
      console.error('failed to save side window settings', caughtErr)
    },
  )
}

const createSideWindow = (): BrowserWindow => {
  const boundsStore = createWindowBoundsStore(
    createJsonFileStorage(
      join(app.getPath('userData'), 'side-window-bounds.json'),
    ),
  )
  const loadedBounds = boundsStore.load().match(
    (bounds) => bounds,
    (caughtErr) => {
      if (!isMissingFile(caughtErr)) {
        console.error('failed to read side window bounds', caughtErr)
      }
      return undefined
    },
  )
  const bounds =
    loadedBounds === undefined
      ? initialWindowBounds(screen.getPrimaryDisplay().workArea)
      : clampWindowBounds(
          loadedBounds,
          screen.getDisplayMatching(loadedBounds).workArea,
        )
  const win = createDesktopWindow({
    ...bounds,
    webPreferences: { sandbox: true },
  })
  win.setAlwaysOnTop(sideWindowAlwaysOnTop)
  setSideWindowTitle(win)
  sideWindow = win

  const saveBounds = () => {
    if (win.isDestroyed()) return
    boundsStore.save(win.getNormalBounds()).match(
      () => undefined,
      (caughtErr) => {
        console.error('failed to save side window bounds', caughtErr)
      },
    )
  }
  const boundsSaver = createDebouncedAction(saveBounds, 200)

  flushSideWindowBounds = boundsSaver.flush
  win.on('move', boundsSaver.schedule)
  win.on('resize', boundsSaver.schedule)
  win.on('closed', () => {
    sideWindow = undefined
  })
  hideOnCloseUnlessQuitting(win, boundsSaver.flush)

  void logRejection(win.loadURL(SIDE_WINDOW_URL), 'failed to load side window')
  showWindow(win)
  return win
}

const openSideWindow = () => {
  if (sideWindow === undefined || sideWindow.isDestroyed()) {
    createSideWindow()
    return
  }

  showWindow(sideWindow)
}

const createMemoWindow = (): BrowserWindow => {
  const win = createDesktopWindow({
    width: 480,
    height: 560,
    minWidth: 360,
    minHeight: 320,
    title: 'Memo',
    webPreferences: { sandbox: true },
  })
  memoWindow = win

  win.on('closed', () => {
    memoWindow = undefined
  })
  hideOnCloseUnlessQuitting(win)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'Escape') return
    event.preventDefault()
    win.hide()
  })

  void logRejection(win.loadURL(MEMO_WINDOW_URL), 'failed to load memo window')
  showWindow(win)
  return win
}

const openMemoWindow = () => {
  if (memoWindow === undefined || memoWindow.isDestroyed()) {
    createMemoWindow()
    return
  }

  showWindow(memoWindow)
}

app.on('before-quit', () => {
  isQuitting = true
  flushSideWindowBounds?.()
})

// Must be registered before `ready`: macOS can deliver the launch URL earlier,
// and a listener added later misses it.
app.on('open-url', (event, url) => {
  event.preventDefault()
  const target = resolveDeepLink(url, TQ_ORIGIN)
  if (target === undefined) return

  if (mainWindow === undefined) {
    pendingUrl = target
    return
  }
  void logRejection(mainWindow.loadURL(target), `failed to load ${target}`)
  showWindow(mainWindow)
})

// Route every external link to the default browser. Registered on
// `web-contents-created` so it also covers windows opened later.
app.on('web-contents-created', (_event, contents) => {
  const navigationSource = (): NavigationSource => {
    const sourceWindow = BrowserWindow.fromWebContents(contents)
    if (sourceWindow === sideWindow) return 'side'
    if (sourceWindow === memoWindow) return 'memo'
    return 'main'
  }

  contents.on('will-navigate', (event) => {
    const action = classifyNavigation(
      contents.getURL(),
      event.url,
      TQ_ORIGIN,
      EXTERNAL_SCHEMES,
      navigationSource(),
    )
    if (action === 'allow') return
    event.preventDefault()
    if (action === 'open-external') void openExternal(event.url)
    if (action === 'open-main') openMainWindow(event.url)
    if (action === 'open-memo') openMemoWindow()
  })

  contents.setWindowOpenHandler(({ url }) => {
    const action = classifyNavigation(
      contents.getURL(),
      url,
      TQ_ORIGIN,
      EXTERNAL_SCHEMES,
      navigationSource(),
    )
    if (action === 'open-external') void openExternal(url)
    if (action === 'open-main') openMainWindow(url)
    if (action === 'open-memo') openMemoWindow()
    return { action: action === 'allow' ? 'allow' : 'deny' }
  })

  contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
    if (!isMainFrame || navigationSource() !== 'side') return
    if (!shouldOpenSideNavigationInMain(url, SIDE_WINDOW_URL, TQ_ORIGIN)) return

    openMainWindow(url)
    void logRejection(
      contents.loadURL(SIDE_WINDOW_URL),
      'failed to restore side window page',
    )
  })
})

// Keep running with no visible window; the default is to quit.
app.on('window-all-closed', () => undefined)

// Top-level `await app.whenReady()` never resolves in an ESM main process.
void app.whenReady().then(() => {
  sideWindowSettingsStore = createSideWindowSettingsStore(
    createJsonFileStorage(
      join(app.getPath('userData'), 'side-window-settings.json'),
    ),
  )
  sideWindowSettingsStore.load().match(
    (settings) => {
      sideWindowAlwaysOnTop = settings?.alwaysOnTop ?? false
    },
    (caughtErr) => {
      if (!isMissingFile(caughtErr)) {
        console.error('failed to read side window settings', caughtErr)
      }
    },
  )

  // Only a packaged app has the `tq` scheme in its Info.plist; in development
  // this would claim the scheme for the bare Electron binary.
  if (app.isPackaged) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)

  const win = createWindow(pendingUrl ?? TQ_ORIGIN)
  mainWindow = win
  pendingUrl = undefined

  if (!globalShortcut.register('Alt+M', openMemoWindow)) {
    console.error('failed to register global shortcut Alt+M')
  }

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate(
        win.webContents.navigationHistory,
        win.webContents,
        clipboard,
        {
          open: openSideWindow,
          alwaysOnTop: sideWindowAlwaysOnTop,
          setAlwaysOnTop: setSideWindowAlwaysOnTop,
        },
      ),
    ),
  )

  app.on('activate', () => {
    showWindow(win)
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
})

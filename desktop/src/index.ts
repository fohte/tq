import { app, BrowserWindow, clipboard, Menu, shell } from 'electron'
import { ResultAsync } from 'neverthrow'

import { EXTERNAL_SCHEMES, TQ_ORIGIN } from '#config'
import { buildMenuTemplate } from '#menu'
import {
  classifyNavigation,
  DEEP_LINK_SCHEME,
  resolveDeepLink,
} from '#navigation'

let isQuitting = false
let mainWindow: BrowserWindow | undefined
// A deep link can arrive before the window exists (cold start from a link).
let pendingUrl: string | undefined

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

const createWindow = (url: string): BrowserWindow => {
  const win = new BrowserWindow({ webPreferences: { sandbox: true } })

  // Hide instead of closing so that reopening from the Dock keeps the page
  // state; `before-quit` lets a real quit through.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  void logRejection(win.loadURL(url), `failed to load ${url}`)

  return win
}

const showWindow = (win: BrowserWindow) => {
  app.show()
  win.show()
}

app.on('before-quit', () => {
  isQuitting = true
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
  contents.on('will-navigate', (event) => {
    const action = classifyNavigation(
      contents.getURL(),
      event.url,
      TQ_ORIGIN,
      EXTERNAL_SCHEMES,
    )
    if (action === 'allow') return
    event.preventDefault()
    if (action === 'open-external') void openExternal(event.url)
  })

  contents.setWindowOpenHandler(({ url }) => {
    const action = classifyNavigation(
      contents.getURL(),
      url,
      TQ_ORIGIN,
      EXTERNAL_SCHEMES,
    )
    if (action === 'open-external') void openExternal(url)
    return { action: action === 'allow' ? 'allow' : 'deny' }
  })
})

// Keep running with no visible window; the default is to quit.
app.on('window-all-closed', () => undefined)

// Top-level `await app.whenReady()` never resolves in an ESM main process.
void app.whenReady().then(() => {
  // Only a packaged app has the `tq` scheme in its Info.plist; in development
  // this would claim the scheme for the bare Electron binary.
  if (app.isPackaged) app.setAsDefaultProtocolClient(DEEP_LINK_SCHEME)

  const win = createWindow(pendingUrl ?? TQ_ORIGIN)
  mainWindow = win
  pendingUrl = undefined

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate(
        win.webContents.navigationHistory,
        win.webContents,
        clipboard,
      ),
    ),
  )

  app.on('activate', () => {
    showWindow(win)
  })
})

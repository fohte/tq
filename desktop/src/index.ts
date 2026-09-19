import { app, BrowserWindow, Menu, shell } from 'electron'
import { ResultAsync } from 'neverthrow'

import { EXTERNAL_SCHEMES, TQ_ORIGIN } from '#config'
import { buildMenuTemplate } from '#menu'
import { classifyNavigation } from '#navigation'

let isQuitting = false

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

const createWindow = (): BrowserWindow => {
  const win = new BrowserWindow({ webPreferences: { sandbox: true } })

  // Hide instead of closing so that reopening from the Dock keeps the page
  // state; `before-quit` lets a real quit through.
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  void logRejection(win.loadURL(TQ_ORIGIN), `failed to load ${TQ_ORIGIN}`)

  return win
}

const showWindow = (win: BrowserWindow) => {
  app.show()
  win.show()
}

app.on('before-quit', () => {
  isQuitting = true
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
  const mainWindow = createWindow()

  Menu.setApplicationMenu(
    Menu.buildFromTemplate(
      buildMenuTemplate(mainWindow.webContents.navigationHistory),
    ),
  )

  app.on('activate', () => {
    showWindow(mainWindow)
  })
})

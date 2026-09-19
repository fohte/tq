import { app, BrowserWindow, globalShortcut, shell } from 'electron'
import { ResultAsync } from 'neverthrow'

import { EXTERNAL_SCHEMES, TQ_ORIGIN } from '#config'
import { classifyNavigation } from '#navigation'

// Three modifiers plus Space isn't in Apple's reserved-shortcut list
// (https://support.apple.com/en-us/102650).
const TOGGLE_SHORTCUT = 'Control+Option+Command+Space'

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

  // Hide instead of closing so that reopening from the Dock or the shortcut
  // keeps the page state; `before-quit` lets a real quit through.
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
  // Needed when triggered by the global shortcut while another app is active.
  app.focus({ steal: true })
}

const toggleWindow = (win: BrowserWindow) => {
  if (win.isVisible() && win.isFocused()) {
    // Hides the whole app rather than just the window, so that focus returns
    // to the previously active app.
    app.hide()
  } else {
    showWindow(win)
  }
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// Top-level `await app.whenReady()` never resolves in an ESM main process.
void app.whenReady().then(() => {
  const mainWindow = createWindow()

  app.on('activate', () => {
    showWindow(mainWindow)
  })

  // `register` returns false, without throwing, when another app already owns
  // the shortcut.
  const registered = globalShortcut.register(TOGGLE_SHORTCUT, () => {
    toggleWindow(mainWindow)
  })
  if (!registered) {
    console.error(`failed to register the global shortcut ${TOGGLE_SHORTCUT}`)
  }
})

/// <reference lib="dom" />

import { contextBridge, ipcRenderer } from 'electron'

import { TQ_ORIGIN } from '#config'
import {
  NAVIGATION_LISTENER_STATE_CHANNEL,
  NAVIGATION_REQUEST_CHANNEL,
  OPEN_IN_MAIN_WINDOW_CHANNEL,
} from '#navigation'

interface TqDesktopApi {
  openInMainWindow(path: string): void
  onNavigateRequest(listener: (path: string) => void): () => void
}

if (location.origin === new URL(TQ_ORIGIN).origin) {
  let listenerCount = 0

  const api: TqDesktopApi = {
    openInMainWindow: (path) => {
      ipcRenderer.send(OPEN_IN_MAIN_WINDOW_CHANNEL, path)
    },
    onNavigateRequest: (listener) => {
      if (typeof listener !== 'function') return () => undefined

      const handler = (_event: Electron.IpcRendererEvent, path: unknown) => {
        if (typeof path === 'string') listener(path)
      }
      ipcRenderer.on(NAVIGATION_REQUEST_CHANNEL, handler)
      listenerCount += 1
      if (listenerCount === 1) {
        ipcRenderer.send(NAVIGATION_LISTENER_STATE_CHANNEL, true)
      }

      let subscribed = true
      return () => {
        if (!subscribed) return
        subscribed = false
        ipcRenderer.removeListener(NAVIGATION_REQUEST_CHANNEL, handler)
        listenerCount -= 1
        if (listenerCount === 0) {
          ipcRenderer.send(NAVIGATION_LISTENER_STATE_CHANNEL, false)
        }
      }
    },
  }

  contextBridge.exposeInMainWorld('tqDesktop', api)
}

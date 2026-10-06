/// <reference lib="dom" />

import { contextBridge, ipcRenderer } from 'electron'

import { TQ_ORIGIN } from '#config'
import {
  createOnNavigateRequest,
  isInternalUrl,
  NAVIGATION_LISTENER_STATE_CHANNEL,
  NAVIGATION_REQUEST_CHANNEL,
  OPEN_IN_MAIN_WINDOW_CHANNEL,
} from '#navigation'

interface TqDesktopApi {
  openInMainWindow(path: string): void
  onNavigateRequest(listener: (path: string) => void): () => void
}

if (isInternalUrl(location.href, TQ_ORIGIN)) {
  const api: TqDesktopApi = {
    openInMainWindow: (path) => {
      ipcRenderer.send(OPEN_IN_MAIN_WINDOW_CHANNEL, path)
    },
    onNavigateRequest: createOnNavigateRequest(
      (listener) => {
        const handler = (_event: Electron.IpcRendererEvent, path: unknown) => {
          listener(path)
        }
        ipcRenderer.on(NAVIGATION_REQUEST_CHANNEL, handler)
        return () =>
          ipcRenderer.removeListener(NAVIGATION_REQUEST_CHANNEL, handler)
      },
      (registered) => {
        ipcRenderer.send(NAVIGATION_LISTENER_STATE_CHANNEL, registered)
      },
    ),
  }

  contextBridge.exposeInMainWorld('tqDesktop', api)
}

export interface TqDesktopApi {
  openInMainWindow(path: string): void
  onNavigateRequest(listener: (path: string) => void): () => void
}

declare global {
  interface Window {
    tqDesktop?: TqDesktopApi
  }
}

export function getTqDesktopApi(): TqDesktopApi | undefined {
  return typeof window === 'undefined' ? undefined : window.tqDesktop
}

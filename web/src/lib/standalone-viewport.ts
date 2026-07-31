// iOS Safari exposes standalone mode via `navigator.standalone` instead of
// the `display-mode` media feature that other browsers support.
interface NavigatorWithIosStandalone extends Navigator {
  standalone?: boolean
}

const DEFAULT_VIEWPORT_CONTENT = 'width=device-width, initial-scale=1.0'
const STANDALONE_VIEWPORT_CONTENT =
  'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no'

export function isStandaloneDisplayMode(win: Window = window): boolean {
  const navigator = win.navigator as NavigatorWithIosStandalone

  return (
    navigator.standalone === true ||
    win.matchMedia('(display-mode: standalone)').matches
  )
}

export function getViewportContent(isStandalone: boolean): string {
  return isStandalone ? STANDALONE_VIEWPORT_CONTENT : DEFAULT_VIEWPORT_CONTENT
}

export function applyStandaloneViewport(
  doc: Document = document,
  win: Window = window,
): void {
  const viewportMeta = doc.querySelector('meta[name="viewport"]')
  if (!viewportMeta) {
    return
  }

  viewportMeta.setAttribute(
    'content',
    getViewportContent(isStandaloneDisplayMode(win)),
  )
}

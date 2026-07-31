// iOS Safari exposes standalone mode via `navigator.standalone` instead of
// the `display-mode` media feature that other browsers support.
interface NavigatorWithIosStandalone extends Navigator {
  standalone?: boolean
}

const ZOOM_DISABLING_SUFFIX = ', maximum-scale=1.0, user-scalable=no'

export function isStandaloneDisplayMode(win: Window = window): boolean {
  const navigator = win.navigator as NavigatorWithIosStandalone

  return (
    navigator.standalone === true ||
    win.matchMedia('(display-mode: standalone)').matches
  )
}

// Appends to the existing viewport content instead of hardcoding the
// non-standalone case, so it stays in sync with whatever web/index.html sets.
export function getViewportContent(
  currentContent: string,
  isStandalone: boolean,
): string {
  return isStandalone
    ? `${currentContent}${ZOOM_DISABLING_SUFFIX}`
    : currentContent
}

export function applyStandaloneViewport(
  doc: Document = document,
  win: Window = window,
): void {
  const viewportMeta = doc.querySelector('meta[name="viewport"]')
  if (!viewportMeta) {
    return
  }

  const currentContent = viewportMeta.getAttribute('content') ?? ''
  viewportMeta.setAttribute(
    'content',
    getViewportContent(currentContent, isStandaloneDisplayMode(win)),
  )
}

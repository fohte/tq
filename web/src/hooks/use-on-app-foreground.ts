import { useEffect, useRef } from 'react'

/**
 * Runs `callback` immediately and again whenever the page regains visibility.
 * A PWA launched from the home screen almost never reloads, so anything
 * meant to run "on app start" (a service worker update check, a push
 * resubscribe) would otherwise never run again across a long stretch spent
 * backgrounded.
 */
export function useOnAppForeground(callback: () => void): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    callbackRef.current()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') callbackRef.current()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
}

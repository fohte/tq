import { useEffect, useRef } from 'react'

/**
 * Runs `callback` immediately and again whenever the page regains visibility.
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

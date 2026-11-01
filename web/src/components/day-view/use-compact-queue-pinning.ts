import { useLayoutEffect, useRef, useState } from 'react'

const MIN_PINNED_QUEUE_VIEWPORT_HEIGHT = 48

export function useCompactQueuePinning(enabled: boolean) {
  const paneRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [isPinned, setIsPinned] = useState(false)

  useLayoutEffect(() => {
    if (!enabled) return

    const updatePinning = () => {
      const pane = paneRef.current
      const header = headerRef.current
      if (pane == null || header == null) return

      const hasQueueViewport =
        pane.clientHeight - header.clientHeight >=
        MIN_PINNED_QUEUE_VIEWPORT_HEIGHT
      setIsPinned((current) =>
        current === hasQueueViewport ? current : hasQueueViewport,
      )
    }

    const pane = paneRef.current
    const header = headerRef.current
    if (pane == null || header == null) return

    const resizeObserver = new ResizeObserver(updatePinning)
    resizeObserver.observe(pane)
    resizeObserver.observe(header)
    updatePinning()

    return () => {
      resizeObserver.disconnect()
    }
  }, [enabled])

  return { paneRef, headerRef, isPinned }
}

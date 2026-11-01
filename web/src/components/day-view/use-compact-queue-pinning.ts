import { useLayoutEffect, useRef, useState } from 'react'

const MIN_QUEUE_VIEWPORT_HEIGHT = 16

export function useCompactQueuePinning(enabled: boolean) {
  const paneRef = useRef<HTMLDivElement>(null)
  const nowPanelRef = useRef<HTMLElement>(null)
  const nowContentRef = useRef<HTMLDivElement>(null)
  const dateHeaderRef = useRef<HTMLDivElement>(null)
  const queueContentRef = useRef<HTMLDivElement>(null)
  const [nowContentMaxHeight, setNowContentMaxHeight] = useState<number>()
  const [queueContentMaxHeight, setQueueContentMaxHeight] = useState<number>()

  useLayoutEffect(() => {
    if (!enabled) return

    const pane = paneRef.current
    const nowPanel = nowPanelRef.current
    const nowContent = nowContentRef.current
    const dateHeader = dateHeaderRef.current
    const queueContent = queueContentRef.current
    if (
      pane == null ||
      nowPanel == null ||
      nowContent == null ||
      queueContent == null
    ) {
      return
    }

    const updateContentHeight = () => {
      const paneMaxHeight = Math.floor(
        (pane.parentElement?.clientHeight ?? pane.clientHeight) * 0.4,
      )
      const nowChromeHeight = nowPanel.clientHeight - nowContent.clientHeight
      const nextContentMaxHeight = Math.max(
        0,
        paneMaxHeight -
          nowChromeHeight -
          (dateHeader?.clientHeight ?? 0) -
          MIN_QUEUE_VIEWPORT_HEIGHT,
      )
      setNowContentMaxHeight((current) =>
        current === nextContentMaxHeight ? current : nextContentMaxHeight,
      )
      const nextQueueContentMaxHeight = Math.max(
        MIN_QUEUE_VIEWPORT_HEIGHT,
        paneMaxHeight - nowPanel.clientHeight - (dateHeader?.clientHeight ?? 0),
      )
      setQueueContentMaxHeight((current) =>
        current === nextQueueContentMaxHeight
          ? current
          : nextQueueContentMaxHeight,
      )
    }

    const resizeObserver = new ResizeObserver(updateContentHeight)
    resizeObserver.observe(pane)
    if (pane.parentElement != null) resizeObserver.observe(pane.parentElement)
    resizeObserver.observe(nowPanel)
    resizeObserver.observe(nowContent)
    resizeObserver.observe(queueContent)
    if (dateHeader != null) resizeObserver.observe(dateHeader)
    updateContentHeight()

    return () => {
      resizeObserver.disconnect()
    }
  }, [enabled])

  return {
    paneRef,
    nowPanelRef,
    nowContentRef,
    dateHeaderRef,
    queueContentRef,
    nowContentMaxHeight,
    queueContentMaxHeight,
  }
}

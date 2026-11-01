import { useLayoutEffect, useRef, useState } from 'react'

export const COMPACT_UPPER_PANE_MAX_HEIGHT_RATIO = 0.4
const MIN_QUEUE_VIEWPORT_HEIGHT = 16
const NOW_CONTENT_VIEWPORT_TARGET_HEIGHT = 90

export function useCompactUpperPaneLayout(
  enabled: boolean,
  hasNowPanel: boolean,
  headerContainerReady: boolean,
) {
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
    if (pane == null || queueContent == null) return

    const updateContentHeight = () => {
      const paneMaxHeight = Math.floor(
        (pane.parentElement?.clientHeight ?? pane.clientHeight) *
          COMPACT_UPPER_PANE_MAX_HEIGHT_RATIO,
      )
      const nowPanelHeight = nowPanel?.clientHeight ?? 0
      const nowChromeHeight =
        nowPanel != null && nowContent != null
          ? nowPanel.clientHeight - nowContent.clientHeight
          : nowPanelHeight
      const availableContentHeight = Math.max(
        0,
        paneMaxHeight - nowChromeHeight - (dateHeader?.clientHeight ?? 0),
      )
      const nowContentReservation = Math.min(
        NOW_CONTENT_VIEWPORT_TARGET_HEIGHT,
        availableContentHeight,
      )
      const queueReservation = Math.max(
        MIN_QUEUE_VIEWPORT_HEIGHT,
        availableContentHeight - nowContentReservation,
      )
      const nextContentMaxHeight = Math.max(
        0,
        availableContentHeight - queueReservation,
      )
      setNowContentMaxHeight((current) => {
        if (nowPanel == null || nowContent == null) return undefined
        return current === nextContentMaxHeight ? current : nextContentMaxHeight
      })
      const nextQueueContentMaxHeight = Math.max(
        MIN_QUEUE_VIEWPORT_HEIGHT,
        paneMaxHeight - nowPanelHeight - (dateHeader?.clientHeight ?? 0),
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
    if (nowPanel != null) resizeObserver.observe(nowPanel)
    if (nowContent != null) resizeObserver.observe(nowContent)
    resizeObserver.observe(queueContent)
    if (dateHeader != null) resizeObserver.observe(dateHeader)
    updateContentHeight()

    return () => {
      resizeObserver.disconnect()
    }
  }, [enabled, hasNowPanel, headerContainerReady])

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

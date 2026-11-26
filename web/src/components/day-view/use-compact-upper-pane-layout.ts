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
  const headerRef = useRef<HTMLDivElement>(null)
  const queueContentRef = useRef<HTMLDivElement>(null)
  const [nowContentMaxHeight, setNowContentMaxHeight] = useState<number>()
  const [queueContentMaxHeight, setQueueContentMaxHeight] = useState<number>()

  useLayoutEffect(() => {
    if (!enabled) return

    const pane = paneRef.current
    const nowPanel = nowPanelRef.current
    const nowContent = nowContentRef.current
    const header = headerRef.current
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
        paneMaxHeight - nowChromeHeight - (header?.clientHeight ?? 0),
      )
      const queueReservation = Math.min(
        MIN_QUEUE_VIEWPORT_HEIGHT,
        availableContentHeight,
      )
      const nowContentReservation = Math.min(
        NOW_CONTENT_VIEWPORT_TARGET_HEIGHT,
        availableContentHeight - queueReservation,
      )
      const nextNowContentMaxHeight = Math.max(0, nowContentReservation)
      const nextQueueContentMaxHeight = Math.max(
        0,
        availableContentHeight - nextNowContentMaxHeight,
      )
      setNowContentMaxHeight((current) => {
        if (nowPanel == null || nowContent == null) return undefined
        return current === nextNowContentMaxHeight
          ? current
          : nextNowContentMaxHeight
      })
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
    if (header != null) resizeObserver.observe(header)
    updateContentHeight()

    return () => {
      resizeObserver.disconnect()
    }
  }, [enabled, hasNowPanel, headerContainerReady])

  return {
    paneRef,
    nowPanelRef,
    nowContentRef,
    headerRef,
    queueContentRef,
    nowContentMaxHeight,
    queueContentMaxHeight,
  }
}

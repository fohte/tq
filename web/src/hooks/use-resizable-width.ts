import { useCallback, useEffect, useState } from 'react'

import { getStorageItem, setStorageItem } from '#lib/local-storage'
import { clampPaneWidth } from '#lib/resizable-pane-width'

interface UseResizableWidthOptions {
  storageKey: string
  defaultWidth: number | (() => number)
  minWidth: number
  maxWidth: number
  responsiveMaxWidth?: (viewportWidth: number) => number
}

interface UseResizableWidthResult {
  width: number
  maxWidth: number
  onValueChange: (width: number) => void
  onValueCommit: (width: number) => void
}

export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
  responsiveMaxWidth,
}: UseResizableWidthOptions): UseResizableWidthResult {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth)
  const [storedWidth, setStoredWidth] = useState(() => {
    const fallback =
      typeof defaultWidth === 'function' ? defaultWidth() : defaultWidth
    const stored = getStorageItem(storageKey).unwrapOr(null)
    if (stored == null || stored.trim() === '') {
      return clampPaneWidth(fallback, minWidth, maxWidth)
    }

    const parsed = Number(stored)
    return Number.isFinite(parsed)
      ? clampPaneWidth(parsed, minWidth, maxWidth)
      : clampPaneWidth(fallback, minWidth, maxWidth)
  })

  useEffect(() => {
    const updateViewportWidth = () => {
      setViewportWidth(window.innerWidth)
    }
    window.addEventListener('resize', updateViewportWidth)
    return () => {
      window.removeEventListener('resize', updateViewportWidth)
    }
  }, [])

  const effectiveMaxWidth = Math.min(
    maxWidth,
    Math.max(minWidth, responsiveMaxWidth?.(viewportWidth) ?? maxWidth),
  )
  const width = clampPaneWidth(storedWidth, minWidth, effectiveMaxWidth)

  const onValueChange = useCallback(
    (nextWidth: number) => {
      setStoredWidth(clampPaneWidth(nextWidth, minWidth, maxWidth))
    },
    [maxWidth, minWidth],
  )

  const onValueCommit = useCallback(
    (nextWidth: number) => {
      const next = clampPaneWidth(nextWidth, minWidth, maxWidth)
      setStoredWidth(next)
      setStorageItem(storageKey, String(next)).unwrapOr(undefined)
    },
    [maxWidth, minWidth, storageKey],
  )

  return {
    width,
    maxWidth: effectiveMaxWidth,
    onValueChange,
    onValueCommit,
  }
}

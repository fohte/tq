import { useCallback, useState } from 'react'

import { getStorageItem, setStorageItem } from '#lib/local-storage'

interface UseResizableWidthOptions {
  storageKey: string
  defaultWidth: number | (() => number)
  minWidth: number
  maxWidth: number
}

function clampWidth(width: number, minWidth: number, maxWidth: number): number {
  return Math.min(maxWidth, Math.max(minWidth, Math.round(width)))
}

export function useResizableWidth({
  storageKey,
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizableWidthOptions): readonly [number, (width: number) => void] {
  const [width, setWidth] = useState(() => {
    const fallback =
      typeof defaultWidth === 'function' ? defaultWidth() : defaultWidth
    const stored = getStorageItem(storageKey).unwrapOr(null)
    if (stored == null || stored.trim() === '') return fallback

    const parsed = Number(stored)
    return Number.isFinite(parsed)
      ? clampWidth(parsed, minWidth, maxWidth)
      : fallback
  })

  const updateWidth = useCallback(
    (nextWidth: number) => {
      const next = clampWidth(nextWidth, minWidth, maxWidth)
      setWidth(next)
      setStorageItem(storageKey, String(next)).unwrapOr(undefined)
    },
    [maxWidth, minWidth, storageKey],
  )

  return [width, updateWidth]
}

import { useEffect, useState } from 'react'

export interface LiveTimerResult {
  /** Elapsed seconds since startTime */
  elapsedSeconds: number
  /** Formatted elapsed time string (e.g., "1:23:45" or "05:30") */
  formatted: string
  /** Whether the elapsed time exceeds the estimate */
  isOverEstimate: boolean
}

/**
 * Returns a live-updating timer for an in-progress task.
 * Updates every second while startTime is provided.
 */
export function useLiveTimer(
  startTime: string | null | undefined,
  estimatedMinutes: number | null | undefined,
): LiveTimerResult {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!startTime) return

    setNow(Date.now())
    const interval = setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  if (!startTime) {
    return { elapsedSeconds: 0, formatted: '00:00', isOverEstimate: false }
  }

  const elapsedMs = now - new Date(startTime).getTime()
  const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000))

  const hours = Math.floor(elapsedSeconds / 3600)
  const minutes = Math.floor((elapsedSeconds % 3600) / 60)
  const seconds = elapsedSeconds % 60

  const pad = (n: number) => n.toString().padStart(2, '0')
  const formatted =
    hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}`
      : `${pad(minutes)}:${pad(seconds)}`

  const isOverEstimate =
    estimatedMinutes != null && elapsedSeconds > estimatedMinutes * 60

  return { elapsedSeconds, formatted, isOverEstimate }
}

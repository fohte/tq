import { useEffect } from 'react'

export function useCompactRefreshErrorLogging(
  enabled: boolean,
  timeBlocksError: unknown,
  schedulesError: unknown,
  memosError?: unknown,
) {
  useEffect(() => {
    if (!enabled) return

    if (timeBlocksError != null) {
      console.error(
        'Failed to refresh time blocks in compact layout',
        timeBlocksError,
      )
    }
    if (schedulesError != null) {
      console.error(
        'Failed to refresh schedules in compact layout',
        schedulesError,
      )
    }
    if (memosError != null) {
      console.error('Failed to refresh memos in compact layout', memosError)
    }
  }, [enabled, timeBlocksError, schedulesError, memosError])
}

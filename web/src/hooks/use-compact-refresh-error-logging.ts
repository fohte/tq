import { useEffect } from 'react'

export function useCompactRefreshErrorLogging(
  enabled: boolean,
  timeBlocksError: unknown,
  schedulesError: unknown,
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
  }, [enabled, timeBlocksError, schedulesError])
}

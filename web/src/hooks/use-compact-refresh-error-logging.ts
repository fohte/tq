import { useEffect } from 'react'

export function useCompactRefreshErrorLogging(
  enabled: boolean,
  source: 'day view' | 'Now panel',
  errors: {
    timeBlocks?: unknown
    schedules?: unknown
    dueTasks?: unknown
    memos?: unknown
  },
) {
  const { timeBlocks, schedules, dueTasks, memos } = errors

  useEffect(() => {
    if (!enabled) return

    if (timeBlocks != null) {
      console.error(
        `Failed to refresh ${source} time blocks in compact layout`,
        timeBlocks,
      )
    }
    if (schedules != null) {
      console.error(
        `Failed to refresh ${source} schedules in compact layout`,
        schedules,
      )
    }
    if (dueTasks != null) {
      console.error(
        `Failed to refresh ${source} due tasks in compact layout`,
        dueTasks,
      )
    }
    if (memos != null) {
      console.error(
        `Failed to refresh ${source} memos in compact layout`,
        memos,
      )
    }
  }, [enabled, source, timeBlocks, schedules, dueTasks, memos])
}

import { useLayoutEffect, useRef } from 'react'

import type { TaskContext } from '#hooks/use-tasks'

interface QueueSnapshot<T> {
  context: TaskContext
  date: string
  scope: string
  value: T
}

export function useDayViewQueueTransition<T>({
  context,
  date,
  scope,
  value,
  isReady,
  hasError,
}: {
  context: TaskContext
  date: string
  scope: string
  value: T
  isReady: boolean
  hasError: boolean
}) {
  const snapshotRef = useRef<QueueSnapshot<T> | null>(null)
  const isDateTransitionPendingRef = useRef(false)
  const previousSnapshot = snapshotRef.current
  const isSnapshotInScope =
    previousSnapshot != null &&
    previousSnapshot.context === context &&
    previousSnapshot.scope === scope
  const isRetainingPreviousQueue =
    isSnapshotInScope &&
    (previousSnapshot.date !== date || isDateTransitionPendingRef.current) &&
    !isReady &&
    !hasError

  useLayoutEffect(() => {
    if (
      (snapshotRef.current != null &&
        (snapshotRef.current.context !== context ||
          snapshotRef.current.scope !== scope)) ||
      hasError
    ) {
      snapshotRef.current = null
      isDateTransitionPendingRef.current = false
    }

    if (isReady && !hasError) {
      snapshotRef.current = { context, date, scope, value }
      isDateTransitionPendingRef.current = false
    } else if (
      snapshotRef.current != null &&
      snapshotRef.current.context === context &&
      snapshotRef.current.scope === scope &&
      snapshotRef.current.date !== date
    ) {
      isDateTransitionPendingRef.current = true
    }
  }, [context, date, hasError, isReady, scope, value])

  return {
    value: isRetainingPreviousQueue ? previousSnapshot.value : value,
    isRetainingPreviousQueue,
    isReady,
    hasError,
  }
}

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
  const previousSnapshot = snapshotRef.current
  const isRetainingPreviousQueue =
    previousSnapshot != null &&
    previousSnapshot.context === context &&
    previousSnapshot.scope === scope &&
    previousSnapshot.date !== date &&
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
    }

    if (isReady && !hasError) {
      snapshotRef.current = { context, date, scope, value }
    }
  }, [context, date, hasError, isReady, scope, value])

  return {
    value: isRetainingPreviousQueue ? previousSnapshot.value : value,
    isRetainingPreviousQueue,
    isReady,
    hasError,
  }
}

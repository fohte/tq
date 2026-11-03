import { useEffect, useSyncExternalStore } from 'react'

import {
  dismissTaskCompletionFailure,
  getTaskCompletionFailureSnapshot,
  subscribeTaskCompletionFailure,
} from '#hooks/task-completion-failure'

export function useTaskCompletionFailure() {
  const failure = useSyncExternalStore(
    subscribeTaskCompletionFailure,
    getTaskCompletionFailureSnapshot,
    getTaskCompletionFailureSnapshot,
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && failure !== null) {
        dismissTaskCompletionFailure(failure.id)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [failure])

  return {
    failure,
    dismiss: dismissTaskCompletionFailure,
  }
}

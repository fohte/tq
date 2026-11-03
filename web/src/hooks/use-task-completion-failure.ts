import { useEffect, useState } from 'react'

import {
  getTaskCompletionFailure,
  type TaskCompletionFailure,
} from '#hooks/task-completion-failure'

const TASK_COMPLETION_FAILED_EVENT = 'tq:task-completion-failed'

export function useTaskCompletionFailure() {
  const [failure, setFailure] = useState<TaskCompletionFailure | null>(null)

  useEffect(() => {
    const handleFailure = (event: Event) => {
      const nextFailure = getTaskCompletionFailure(event)
      if (nextFailure !== null) setFailure(nextFailure)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFailure(null)
    }

    window.addEventListener(TASK_COMPLETION_FAILED_EVENT, handleFailure)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener(TASK_COMPLETION_FAILED_EVENT, handleFailure)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return {
    failure,
    dismiss: (failureId: string) => {
      setFailure((current) => (current?.id === failureId ? null : current))
    },
  }
}

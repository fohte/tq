import { useCallback } from 'react'

import { useCompleteTask } from '#hooks/use-task-mutations'
import type { TaskDetail } from '#hooks/use-tasks'
import { notifyUrlCopied } from '#hooks/use-url-copied-toast'

interface ClipboardWriter {
  writeText: (text: string) => Promise<void>
}

function isClipboardWriter(value: unknown): value is ClipboardWriter {
  return (
    typeof value === 'object' &&
    value !== null &&
    'writeText' in value &&
    typeof value.writeText === 'function'
  )
}

export function useSearchModalTaskActions(onOpenChangeRef: {
  current: (open: boolean) => void
}) {
  const { mutate } = useCompleteTask()

  const completeTask = useCallback(
    (task: Pick<TaskDetail, 'id'>) => {
      onOpenChangeRef.current(false)
      mutate({ id: task.id })
    },
    [mutate, onOpenChangeRef],
  )

  const copyTaskUrl = useCallback(
    (task: Pick<TaskDetail, 'id'>) => {
      const url = new URL(
        `/tasks/${task.id}`,
        window.location.origin,
      ).toString()
      const clipboard: unknown = Reflect.get(navigator, 'clipboard')

      if (!isClipboardWriter(clipboard)) {
        console.error(
          'Failed to copy task URL',
          new Error('Clipboard API is unavailable'),
        )
        return
      }

      const copyPromise = clipboard.writeText(url)
      void copyPromise.then(
        () => {
          notifyUrlCopied(url)
          onOpenChangeRef.current(false)
        },
        (error: unknown) => {
          console.error('Failed to copy task URL', error)
        },
      )
    },
    [onOpenChangeRef],
  )

  return { completeTask, copyTaskUrl }
}

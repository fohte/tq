import type { FocusEvent, ReactNode } from 'react'
import { useEffect, useState } from 'react'

import { TaskWaitEntryAppearance } from '#components/task/task-wait-entry-appearance'
import { TaskWaitMutationError } from '#components/task/task-wait-mutation-error'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import {
  useAcknowledgeTaskWait,
  useDeleteTaskWait,
  useResolveTaskWait,
  useUpdateTaskWait,
} from '#hooks/use-task-waits'
import type { TaskWait } from '#hooks/use-tasks'

export function TaskWaitEntry({
  taskId,
  wait,
  layout = 'standalone',
  waitModeControl,
}: {
  taskId: string
  wait: TaskWait
  layout?: 'standalone' | 'github-blocker'
  waitModeControl?: ReactNode
}) {
  const [followUpDate, setFollowUpDate] = useState(wait.followUpDate)
  useEffect(() => {
    setFollowUpDate(wait.followUpDate)
  }, [wait.followUpDate])
  const updateWait = useUpdateTaskWait(taskId)
  const resolveWait = useResolveTaskWait(taskId)
  const acknowledgeWait = useAcknowledgeTaskWait(taskId)
  const deleteWait = useDeleteTaskWait(taskId)
  const { onChange, flush, cancel } = useDebouncedSave((body) => {
    updateWait.mutate({ waitId: wait.id, body })
  })
  const disabled =
    updateWait.isPending ||
    resolveWait.isPending ||
    acknowledgeWait.isPending ||
    deleteWait.isPending

  const saveFollowUpDate = () => {
    if (followUpDate === wait.followUpDate) return
    updateWait.mutate(
      { waitId: wait.id, followUpDate },
      {
        onError: () => {
          setFollowUpDate(wait.followUpDate)
        },
      },
    )
  }

  const handleFollowUpDateBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (
      event.relatedTarget instanceof Element &&
      event.relatedTarget.closest('[data-wait-action]') != null
    )
      return
    saveFollowUpDate()
  }

  return (
    <TaskWaitEntryAppearance
      wait={wait}
      layout={layout}
      waitModeControl={waitModeControl}
      followUpDate={followUpDate}
      disabled={disabled}
      onFollowUpDateChange={setFollowUpDate}
      onFollowUpDateBlur={handleFollowUpDateBlur}
      onResolve={() => {
        flush()
        saveFollowUpDate()
        resolveWait.mutate(wait.id)
      }}
      onAcknowledge={() => {
        acknowledgeWait.mutate(wait.id)
      }}
      onRemove={() => {
        cancel()
        deleteWait.mutate(wait.id)
      }}
      onBodyChange={onChange}
      onExitEditMode={flush}
      errors={
        <>
          {updateWait.isError && (
            <TaskWaitMutationError
              message={
                updateWait.error instanceof Error
                  ? updateWait.error.message
                  : 'Unable to update wait.'
              }
            />
          )}
          {resolveWait.isError && (
            <TaskWaitMutationError
              message={
                resolveWait.error instanceof Error
                  ? resolveWait.error.message
                  : 'Unable to resolve wait.'
              }
            />
          )}
          {acknowledgeWait.isError && (
            <TaskWaitMutationError
              message={
                acknowledgeWait.error instanceof Error
                  ? acknowledgeWait.error.message
                  : 'Unable to acknowledge the reply.'
              }
            />
          )}
          {deleteWait.isError && (
            <TaskWaitMutationError
              message={
                deleteWait.error instanceof Error
                  ? deleteWait.error.message
                  : 'Unable to remove wait.'
              }
            />
          )}
        </>
      }
    />
  )
}

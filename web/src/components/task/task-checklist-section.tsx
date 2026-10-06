import { useState } from 'react'

import { TaskChecklistList } from '#components/task/task-checklist-list'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import {
  useCreateTaskChecklist,
  useCreateTaskChecklistItem,
  useDeleteTaskChecklist,
  useDeleteTaskChecklistItem,
  useMoveTaskChecklistItem,
  useReorderTaskChecklists,
  useSetTaskChecklistItemChecked,
  useTaskChecklists,
  useUpdateTaskChecklist,
  useUpdateTaskChecklistItem,
} from '#hooks/use-task-checklists'

export function TaskChecklistSection({ taskId }: { taskId: string }) {
  const [mutationError, setMutationError] = useState(false)
  const { data: checklists, isLoading, isError } = useTaskChecklists(taskId)
  const createChecklist = useCreateTaskChecklist(taskId)
  const updateChecklist = useUpdateTaskChecklist(taskId)
  const reorderChecklists = useReorderTaskChecklists(taskId)
  const deleteChecklist = useDeleteTaskChecklist(taskId)
  const createItem = useCreateTaskChecklistItem(taskId)
  const updateItem = useUpdateTaskChecklistItem(taskId)
  const deleteItem = useDeleteTaskChecklistItem(taskId)
  const moveItem = useMoveTaskChecklistItem(taskId)
  const setItemChecked = useSetTaskChecklistItemChecked(taskId)
  const mutationCallbacks = {
    onError: () => {
      setMutationError(true)
    },
    onSuccess: () => {
      setMutationError(false)
    },
  }

  if (isLoading) {
    return <SectionLoadingIndicator label="checklists" />
  }

  if (isError) {
    return (
      <p className="font-mono text-xs text-destructive">
        Failed to load checklists.
      </p>
    )
  }

  return (
    <>
      {mutationError && (
        <p role="alert" className="font-mono text-xs text-destructive">
          Failed to save checklist changes.
        </p>
      )}
      <TaskChecklistList
        checklists={checklists ?? []}
        onCreateChecklist={() => {
          createChecklist.mutate({ name: null }, mutationCallbacks)
        }}
        onUpdateChecklist={(checklistId, input) => {
          updateChecklist.mutate({ checklistId, input }, mutationCallbacks)
        }}
        onReorderChecklists={(checklistIds) => {
          reorderChecklists.mutate(checklistIds, mutationCallbacks)
        }}
        onDeleteChecklist={(checklistId) => {
          deleteChecklist.mutate(checklistId, mutationCallbacks)
        }}
        onCreateItem={(checklistId, input) => {
          createItem.mutate({ checklistId, input }, mutationCallbacks)
        }}
        onUpdateItem={(itemId, input) => {
          updateItem.mutate({ itemId, input }, mutationCallbacks)
        }}
        onDeleteItem={(itemId) => {
          deleteItem.mutate(itemId, mutationCallbacks)
        }}
        onMoveItem={(itemId, input) => {
          moveItem.mutate({ itemId, input }, mutationCallbacks)
        }}
        onSetItemChecked={(itemId, checked) => {
          setItemChecked.mutate({ itemId, checked }, mutationCallbacks)
        }}
      />
    </>
  )
}

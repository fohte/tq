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
    <TaskChecklistList
      checklists={checklists ?? []}
      onCreateChecklist={() => {
        createChecklist.mutate({ name: null })
      }}
      onUpdateChecklist={(checklistId, input) => {
        updateChecklist.mutate({ checklistId, input })
      }}
      onReorderChecklists={(checklistIds) => {
        reorderChecklists.mutate(checklistIds)
      }}
      onDeleteChecklist={(checklistId) => {
        deleteChecklist.mutate(checklistId)
      }}
      onCreateItem={(checklistId, input) => {
        createItem.mutate({ checklistId, input })
      }}
      onUpdateItem={(itemId, input) => {
        updateItem.mutate({ itemId, input })
      }}
      onDeleteItem={(itemId) => {
        deleteItem.mutate(itemId)
      }}
      onMoveItem={(itemId, input) => {
        moveItem.mutate({ itemId, input })
      }}
      onSetItemChecked={(itemId, checked) => {
        setItemChecked.mutate({ itemId, checked })
      }}
    />
  )
}

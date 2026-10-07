import { useState } from 'react'

import { TaskChecklistList } from '#components/task/task-checklist-list'
import { SectionLoadingIndicator } from '#components/ui/section-loading-indicator'
import type { GithubLink } from '#hooks/use-github-link'
import {
  useCreateTaskChecklist,
  useCreateTaskChecklistItem,
  useDeleteTaskChecklist,
  useDeleteTaskChecklistItem,
  useLinkTaskChecklistItemToGithub,
  useMoveTaskChecklistItem,
  usePromoteTaskChecklistItem,
  useReorderTaskChecklists,
  useSetTaskChecklistItemChecked,
  useTaskChecklists,
  useUpdateTaskChecklist,
  useUpdateTaskChecklistItem,
} from '#hooks/use-task-checklists'
import type { Task } from '#hooks/use-tasks'
import { useTaskList } from '#hooks/use-tasks'

export function TaskChecklistSection({
  taskId,
  githubLinks,
  subtasks,
}: {
  taskId: string
  githubLinks: GithubLink[]
  subtasks?: Task[] | undefined
}) {
  const [mutationError, setMutationError] = useState(false)
  const { data: checklists, isLoading, isError } = useTaskChecklists(taskId)
  const subtaskQuery = useTaskList(
    { parentId: taskId },
    { enabled: subtasks == null },
  )
  const linkedSubtasks = subtasks ?? subtaskQuery.categorized.all
  const createChecklist = useCreateTaskChecklist(taskId)
  const updateChecklist = useUpdateTaskChecklist(taskId)
  const reorderChecklists = useReorderTaskChecklists(taskId)
  const deleteChecklist = useDeleteTaskChecklist(taskId)
  const createItem = useCreateTaskChecklistItem(taskId)
  const updateItem = useUpdateTaskChecklistItem(taskId)
  const deleteItem = useDeleteTaskChecklistItem(taskId)
  const moveItem = useMoveTaskChecklistItem(taskId)
  const setItemChecked = useSetTaskChecklistItemChecked(taskId)
  const linkItemToGithub = useLinkTaskChecklistItemToGithub()
  const promoteItem = usePromoteTaskChecklistItem()
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
        githubLinks={githubLinks}
        subtasks={linkedSubtasks}
        linkGithubErrorMessage={
          linkItemToGithub.isError ? linkItemToGithub.error.message : undefined
        }
        isLinkingGithub={linkItemToGithub.isPending}
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
        onLinkGithub={(itemId, url, onSuccess) => {
          linkItemToGithub.mutate({ itemId, url }, { onSuccess })
        }}
        onPromoteItem={(itemId) => {
          promoteItem.mutate(itemId, mutationCallbacks)
        }}
      />
    </>
  )
}

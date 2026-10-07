import { useState } from 'react'

import { SidebarParentFieldAppearance } from '#components/task/sidebar-parent-field-appearance'
import { useSearchTasks } from '#hooks/use-search'
import { useTaskList, useUpdateTaskParent } from '#hooks/use-tasks'
import { getDescendantIds } from '#lib/task-tree'

export function SidebarParentField({
  taskId,
  parentId,
}: {
  taskId: string
  parentId: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState('')

  const { categorized } = useTaskList({
    context: 'all',
    status: 'all',
    limit: 'unlimited',
  })
  const updateParent = useUpdateTaskParent()

  const allTasks = categorized.all
  const invalidParentIds = new Set([
    taskId,
    ...getDescendantIds(allTasks, taskId),
  ])
  const currentParent = allTasks.find((t) => t.id === parentId) ?? null

  const { data: searchResults, isFetching } = useSearchTasks(query)
  const candidates = (searchResults ?? []).filter(
    (t) => !invalidParentIds.has(t.id),
  )

  const stopEditing = () => {
    setIsEditing(false)
    setQuery('')
  }

  return (
    <SidebarParentFieldAppearance
      currentParent={
        currentParent != null
          ? { number: currentParent.number, title: currentParent.title }
          : null
      }
      isEditing={isEditing}
      onOpenChange={(open) => {
        if (open) {
          setIsEditing(true)
        } else {
          stopEditing()
        }
      }}
      query={query}
      onQueryChange={setQuery}
      isFetching={isFetching}
      candidates={candidates}
      onClear={() => {
        updateParent.mutate({ id: taskId, parentId: null })
        stopEditing()
      }}
      onSelectCandidate={(candidate) => {
        updateParent.mutate({ id: taskId, parentId: candidate.id })
        stopEditing()
      }}
    />
  )
}

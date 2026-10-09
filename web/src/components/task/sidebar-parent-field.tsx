import { useState } from 'react'

import { SidebarParentFieldAppearance } from '#components/task/sidebar-parent-field-appearance'
import { useSearchTasks } from '#hooks/use-search'
import { useSelfAndDescendantIds, useUpdateTaskParent } from '#hooks/use-tasks'

export function SidebarParentField({
  taskId,
  parentNumber,
  parentTitle,
}: {
  taskId: string
  parentNumber: number | null
  parentTitle: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [query, setQuery] = useState('')

  const invalidParentIds = useSelfAndDescendantIds(taskId, isEditing)
  const updateParent = useUpdateTaskParent()

  const currentParent =
    parentNumber != null && parentTitle != null
      ? { number: parentNumber, title: parentTitle }
      : null

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
      currentParent={currentParent}
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
        updateParent.mutate({ id: taskId, parentId: null, parent: null })
        stopEditing()
      }}
      onSelectCandidate={(candidate) => {
        updateParent.mutate({
          id: taskId,
          parentId: candidate.id,
          parent: { number: candidate.number, title: candidate.title },
        })
        stopEditing()
      }}
    />
  )
}

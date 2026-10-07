import { useCallback, useEffect, useMemo, useState } from 'react'

import { LinkExistingProjectTaskMenuAppearance } from '#components/project/link-existing-project-task-menu-appearance'
import { useProjects, useProjectTaskIds } from '#hooks/use-projects'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { useUpdateTask } from '#hooks/use-tasks'

export function LinkExistingProjectTaskMenu({
  open,
  onOpenChange,
  projectId,
  projectTitle,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectTitle: string
}) {
  const [linkDialogCandidate, setLinkDialogCandidate] =
    useState<SearchResult | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) {
      setLinkDialogCandidate(null)
      setQuery('')
    }
  }, [open])

  const { data: projects } = useProjects(
    { context: 'all', status: 'all' },
    { enabled: open },
  )
  const { data: projectTaskIds } = useProjectTaskIds(projectId, {
    enabled: open,
  })
  const excludedTaskIds = useMemo(
    () => new Set(projectTaskIds ?? []),
    [projectTaskIds],
  )
  const { data: searchResults, isFetching } = useSearchTasks(query)
  const candidates = (searchResults ?? []).filter(
    (t) => !excludedTaskIds.has(t.id),
  )
  const updateTask = useUpdateTask()

  const projectTitleById = useMemo(
    () => new Map((projects ?? []).map((p) => [p.id, p.title])),
    [projects],
  )

  const closeAndReset = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const selectCandidate = useCallback(
    (candidate: SearchResult) => {
      if (candidate.projectId == null) {
        updateTask.mutate(
          { id: candidate.id, input: { projectId } },
          { onSuccess: closeAndReset },
        )
      } else {
        setLinkDialogCandidate(candidate)
      }
    },
    [projectId, updateTask, closeAndReset],
  )

  return (
    <LinkExistingProjectTaskMenuAppearance
      open={open}
      onOpenChange={onOpenChange}
      query={query}
      onQueryChange={setQuery}
      candidates={candidates}
      isFetching={isFetching}
      onSelectCandidate={selectCandidate}
      confirmCandidate={linkDialogCandidate}
      currentProjectTitle={
        linkDialogCandidate?.projectId != null
          ? projectTitleById.get(linkDialogCandidate.projectId)
          : undefined
      }
      projectTitle={projectTitle}
      onConfirmDialogOpenChange={(nextOpen) => {
        if (!nextOpen) setLinkDialogCandidate(null)
      }}
      onConfirm={() => {
        if (linkDialogCandidate == null) return
        updateTask.mutate(
          { id: linkDialogCandidate.id, input: { projectId } },
          {
            onSuccess: () => {
              setLinkDialogCandidate(null)
              closeAndReset()
            },
          },
        )
      }}
    />
  )
}

import { useCallback, useEffect, useMemo, useState } from 'react'

import { LinkExistingProjectTaskDialog } from '#components/project/link-existing-project-task-dialog'
import { TaskSearchCandidateDialogAppearance } from '#components/task/task-search-candidate-dialog'
import { useProjects, useProjectTaskIds } from '#hooks/use-projects'
import { type SearchResult, useSearchTasks } from '#hooks/use-search'
import { useUpdateTask } from '#hooks/use-tasks'

export function LinkExistingProjectTaskMenuAppearance({
  open,
  onOpenChange,
  query,
  onQueryChange,
  candidates,
  isFetching,
  onSelectCandidate,
  confirmCandidate,
  currentProjectTitle,
  projectTitle,
  onConfirmDialogOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQueryChange: (query: string) => void
  candidates: SearchResult[]
  isFetching: boolean
  onSelectCandidate: (candidate: SearchResult) => void
  confirmCandidate: SearchResult | null
  currentProjectTitle: string | undefined
  projectTitle: string
  onConfirmDialogOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <>
      <TaskSearchCandidateDialogAppearance
        open={open}
        onOpenChange={onOpenChange}
        title="Link existing task"
        query={query}
        onQueryChange={onQueryChange}
        candidates={candidates}
        isFetching={isFetching}
        onSelectCandidate={onSelectCandidate}
      />

      <LinkExistingProjectTaskDialog
        candidate={confirmCandidate}
        currentProjectTitle={currentProjectTitle}
        projectTitle={projectTitle}
        open={confirmCandidate != null}
        onOpenChange={onConfirmDialogOpenChange}
        onConfirm={onConfirm}
      />
    </>
  )
}

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

  const { data: projects } = useProjects(undefined, { enabled: open })
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

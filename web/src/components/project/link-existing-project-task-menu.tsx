import { useCallback, useEffect, useMemo, useState } from 'react'

import { LinkExistingProjectTaskDialog } from '#components/project/link-existing-project-task-dialog'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { useProjects } from '#hooks/use-projects'
import { type SearchResult } from '#hooks/use-search'
import { useUpdateTask } from '#hooks/use-tasks'

export function LinkExistingProjectTaskMenu({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  excludedTaskIds,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectTitle: string
  excludedTaskIds: Set<string>
}) {
  const [linkDialogCandidate, setLinkDialogCandidate] =
    useState<SearchResult | null>(null)

  useEffect(() => {
    if (open) {
      setLinkDialogCandidate(null)
    }
  }, [open])

  const { data: projects } = useProjects(undefined, { enabled: open })
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
    <>
      <TaskSearchCandidateDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Link existing task"
        excludedTaskIds={excludedTaskIds}
        onSelectCandidate={selectCandidate}
      />

      <LinkExistingProjectTaskDialog
        candidate={linkDialogCandidate}
        currentProjectTitle={
          linkDialogCandidate?.projectId != null
            ? projectTitleById.get(linkDialogCandidate.projectId)
            : undefined
        }
        projectTitle={projectTitle}
        open={linkDialogCandidate != null}
        onOpenChange={(nextOpen) => {
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
    </>
  )
}

import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { Button } from '#components/ui/button'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import type { SearchResult } from '#hooks/use-search'
import type { LinkedTaskSummary } from '#hooks/use-tasks'
import { useUpdateTaskBlockedBy } from '#hooks/use-tasks'

export function TaskDependenciesSection({
  taskId,
  blockedBy,
  blocking,
}: {
  taskId: string
  blockedBy: LinkedTaskSummary[]
  blocking: LinkedTaskSummary[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>dependencies</SectionHeading>

      <div className="flex flex-col gap-3">
        <BlockedByGroup taskId={taskId} blockedBy={blockedBy} />

        {blocking.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-2xs text-muted-foreground-faint">
              blocking
            </span>
            <Panel>
              {blocking.map((task) => (
                <TaskRowAppearance key={task.id} task={task} />
              ))}
            </Panel>
          </div>
        )}
      </div>
    </div>
  )
}

// Adding a blocker only makes sense from the blocked-by side — the
// other direction means editing the other task's blockers.
function BlockedByGroup({
  taskId,
  blockedBy,
}: {
  taskId: string
  blockedBy: LinkedTaskSummary[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const updateBlockedBy = useUpdateTaskBlockedBy()

  const excludedTaskIds = useMemo(
    () => new Set([taskId, ...blockedBy.map((task) => task.id)]),
    [taskId, blockedBy],
  )

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        blocked by
      </span>
      <Panel>
        {blockedBy.map((task) => (
          <TaskRowAppearance
            key={task.id}
            task={task}
            trailing={
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  updateBlockedBy.mutate({
                    id: taskId,
                    blockedBy: blockedBy.filter((t) => t.id !== task.id),
                  })
                }}
                disabled={updateBlockedBy.isPending}
                aria-label={`Remove #${String(task.number)} as blocker`}
                className="shrink-0 text-muted-foreground-faint hover:text-destructive"
              >
                <X className="size-3.5" />
              </Button>
            }
          />
        ))}
        <button
          type="button"
          onClick={() => {
            setDialogOpen(true)
          }}
          className="flex min-h-11 w-full items-center gap-1.5 border-t border-dashed border-border px-3 font-mono text-xs text-muted-foreground-faint transition-colors hover:text-muted-foreground"
        >
          <Plus className="size-3" />
          add blocker
        </button>
      </Panel>

      <TaskSearchCandidateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add blocker"
        excludedTaskIds={excludedTaskIds}
        onSelectCandidate={(candidate: SearchResult) => {
          updateBlockedBy.mutate({
            id: taskId,
            blockedBy: [...blockedBy, candidate],
          })
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

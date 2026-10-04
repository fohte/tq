import { Button } from '@fohte/ui/button'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { GitHubNotifyEventsPicker } from '#components/task/github-notify-events-picker'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { Panel } from '#components/ui/panel'
import { SectionHeading } from '#components/ui/section-heading'
import type { GithubBlocker } from '#hooks/use-github-link'
import { useUpdateGithubLinkNotifyEvents } from '#hooks/use-github-link'
import type { SearchResult } from '#hooks/use-search'
import type { LinkedTaskSummary } from '#hooks/use-tasks'
import { useUpdateTaskBlockedBy } from '#hooks/use-tasks'

export function TaskDependenciesSection({
  taskId,
  blockedBy,
  blocking,
  githubBlockers,
}: {
  taskId: string
  blockedBy: LinkedTaskSummary[]
  blocking: LinkedTaskSummary[]
  githubBlockers: GithubBlocker[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>dependencies</SectionHeading>

      <div className="flex flex-col gap-3">
        <BlockedByGroup
          taskId={taskId}
          blockedBy={blockedBy}
          githubBlockers={githubBlockers}
        />

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
  githubBlockers,
}: {
  taskId: string
  blockedBy: LinkedTaskSummary[]
  githubBlockers: GithubBlocker[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const updateBlockedBy = useUpdateTaskBlockedBy()
  const updateNotifyEvents = useUpdateGithubLinkNotifyEvents(taskId)
  const githubBlockerUrls = githubBlockers.map(({ url }) => url)

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
                    githubBlockerUrls,
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
        {githubBlockers.map((blocker) => (
          <div
            key={blocker.id}
            className="flex items-center gap-2 border-b border-border px-3 py-2 last:border-b-0"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <a
                href={blocker.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2 text-sm hover:underline"
                title={`${blocker.owner}/${blocker.repo}#${String(blocker.number)}`}
              >
                <GithubRefSummary
                  kind={blocker.kind}
                  state={blocker.state}
                  owner={blocker.owner}
                  repo={blocker.repo}
                  number={blocker.number}
                  title={blocker.title}
                  refClassName="min-w-0 shrink truncate"
                  titleClassName={
                    blocker.state === 'open'
                      ? 'min-w-0 flex-1'
                      : 'min-w-0 flex-1 text-muted-foreground'
                  }
                />
              </a>
              <span className="font-mono text-2xs text-muted-foreground-faint">
                github · {blocker.state}
              </span>
            </div>
            <GitHubNotifyEventsPicker
              value={blocker.notifyEvents}
              onChange={(notifyEvents) => {
                updateNotifyEvents.mutate({
                  linkId: blocker.id,
                  notifyEvents,
                })
              }}
              disabled={updateNotifyEvents.isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => {
                updateBlockedBy.mutate({
                  id: taskId,
                  blockedBy,
                  githubBlockerUrls: githubBlockerUrls.filter(
                    (url) => url !== blocker.url,
                  ),
                })
              }}
              disabled={updateBlockedBy.isPending}
              aria-label={`Remove ${blocker.owner}/${blocker.repo}#${String(blocker.number)} as blocker`}
              className="shrink-0 text-muted-foreground-faint hover:text-destructive"
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setDialogOpen(true)
          }}
          className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-center gap-1.5 border-t border-dashed border-border px-3 font-mono text-xs text-muted-foreground-faint transition-colors hover:text-muted-foreground"
        >
          <Plus className="size-3" />
          add blocker
        </Button>
      </Panel>

      <TaskSearchCandidateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Add blocker"
        excludedTaskIds={excludedTaskIds}
        excludedGithubUrls={githubBlockerUrls}
        allowGithubUrls
        onSelectCandidate={(candidate: SearchResult) => {
          updateBlockedBy.mutate({
            id: taskId,
            blockedBy: [...blockedBy, candidate],
            githubBlockerUrls,
          })
          setDialogOpen(false)
        }}
        onSelectGithubCandidate={(candidate) => {
          updateBlockedBy.mutate({
            id: taskId,
            blockedBy,
            githubBlockerUrls: [...githubBlockerUrls, candidate.url],
          })
          setDialogOpen(false)
        }}
      />
    </div>
  )
}

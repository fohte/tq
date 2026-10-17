import { Button } from '@fohte/ui/button'
import { Panel } from '@fohte/ui/panel'
import { Plus, X } from 'lucide-react'
import { useMemo, useState } from 'react'

import { GithubBlockerRowAppearance } from '#components/task/github-blocker-row-appearance'
import { GithubBlockerUpdateError } from '#components/task/github-blocker-update-error'
import { GithubWaitModeSelect } from '#components/task/github-wait-mode-select'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { TaskWaitEntry } from '#components/task/task-wait-entry'
import { TaskWaitFormDialog } from '#components/task/task-wait-form-dialog'
import { TaskWaitMutationError } from '#components/task/task-wait-mutation-error'
import { SectionHeading } from '#components/ui/section-heading'
import type { GithubBlocker } from '#hooks/use-github-link'
import { useUpdateGithubLinkNotifyEvents } from '#hooks/use-github-link'
import type { SearchResult } from '#hooks/use-search'
import { useCreateTaskWait, useDeleteTaskWait } from '#hooks/use-task-waits'
import type { LinkedTaskSummary, TaskWait } from '#hooks/use-tasks'
import { useUpdateTaskBlockedBy } from '#hooks/use-tasks'
import { addLocalDays, formatLocalDate } from '#lib/date-range'
import { isTaskWaitBlocking, needsWaitAcknowledgement } from '#lib/task-waits'

export function TaskDependenciesSection({
  taskId,
  blockedBy,
  blocking,
  githubBlockers,
  waits,
}: {
  taskId: string
  blockedBy: LinkedTaskSummary[]
  blocking: LinkedTaskSummary[]
  githubBlockers: GithubBlocker[]
  waits: TaskWait[]
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <SectionHeading level={3}>dependencies</SectionHeading>

      <div className="flex flex-col gap-3">
        <BlockedByGroup
          taskId={taskId}
          blockedBy={blockedBy}
          githubBlockers={githubBlockers}
          waits={waits}
        />

        {blocking.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-2xs text-muted-foreground-faint">
              blocking
            </span>
            <Panel padding="none">
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
  waits,
}: {
  taskId: string
  blockedBy: LinkedTaskSummary[]
  githubBlockers: GithubBlocker[]
  waits: TaskWait[]
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [waitDialogOpen, setWaitDialogOpen] = useState(false)
  const [newWaitBody, setNewWaitBody] = useState('')
  const [newWaitFollowUpDate, setNewWaitFollowUpDate] = useState('')
  const [githubWaitBlocker, setGithubWaitBlocker] =
    useState<GithubBlocker | null>(null)
  const updateBlockedBy = useUpdateTaskBlockedBy()
  const updateNotifyEvents = useUpdateGithubLinkNotifyEvents(taskId)
  const createWait = useCreateTaskWait()
  const deleteWait = useDeleteTaskWait(taskId)
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
      <Panel padding="none">
        {waits
          .filter((wait) => wait.githubLinkId == null)
          .map((wait) => (
            <TaskWaitEntry
              key={`${wait.id}:${wait.resolvedAt ?? ''}`}
              taskId={taskId}
              wait={wait}
            />
          ))}
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
        {githubBlockers.map((blocker) => {
          const linkedReplyWaits = waits.filter(
            (wait) => wait.githubLinkId === blocker.id,
          )
          const activeReplyWait = linkedReplyWaits.find(isTaskWaitBlocking)
          const replyWait =
            activeReplyWait ??
            linkedReplyWaits[linkedReplyWaits.length - 1] ??
            null
          const waitMode =
            activeReplyWait != null ? 'until-reply' : 'until-closed'
          const handleWaitModeChange = (
            mode: 'until-closed' | 'until-reply',
          ) => {
            if (mode === 'until-closed') {
              if (activeReplyWait != null) deleteWait.mutate(activeReplyWait.id)
              return
            }
            if (blocker.state !== 'open') return

            createWait.reset()
            setNewWaitBody('')
            setNewWaitFollowUpDate(addLocalDays(formatLocalDate(new Date()), 3))
            setGithubWaitBlocker(blocker)
            setWaitDialogOpen(true)
          }
          const waitModeControl =
            blocker.state === 'open' ? (
              <GithubWaitModeSelect
                blocker={blocker}
                value={waitMode}
                disabled={createWait.isPending || deleteWait.isPending}
                onChange={handleWaitModeChange}
              />
            ) : undefined

          return (
            <GithubBlockerRowAppearance
              key={blocker.id}
              blocker={blocker}
              waitModeControl={
                activeReplyWait == null ? waitModeControl : undefined
              }
              needsAcknowledgement={
                replyWait != null && needsWaitAcknowledgement(replyWait)
              }
              resolved={replyWait != null && activeReplyWait == null}
              notifyEventsDisabled={
                updateNotifyEvents.isPending || updateBlockedBy.isPending
              }
              removeDisabled={updateBlockedBy.isPending}
              onNotifyEventsChange={(notifyEvents) => {
                updateNotifyEvents.mutate({
                  linkId: blocker.id,
                  notifyEvents,
                })
              }}
              onRemove={() => {
                updateBlockedBy.mutate({
                  id: taskId,
                  blockedBy,
                  githubBlockerUrls: githubBlockerUrls.filter(
                    (url) => url !== blocker.url,
                  ),
                })
              }}
            >
              {replyWait != null && (
                <TaskWaitEntry
                  key={`${replyWait.id}:${replyWait.resolvedAt ?? ''}`}
                  taskId={taskId}
                  wait={replyWait}
                  layout="github-blocker"
                  waitModeControl={
                    activeReplyWait != null ? waitModeControl : undefined
                  }
                />
              )}
            </GithubBlockerRowAppearance>
          )
        })}
        <Button
          type="button"
          variant="ghost"
          disabled={updateBlockedBy.isPending}
          onClick={() => {
            setDialogOpen(true)
          }}
          className="h-auto min-h-0 shrink justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 flex min-h-11 w-full items-center gap-1.5 border-t border-dashed border-border px-3 font-mono text-xs text-muted-foreground-faint transition-colors hover:text-muted-foreground"
        >
          <Plus className="size-3" />
          add blocker
        </Button>
      </Panel>

      {updateBlockedBy.isError && (
        <GithubBlockerUpdateError
          message={
            updateBlockedBy.error instanceof Error
              ? updateBlockedBy.error.message
              : 'Unable to update blockers.'
          }
        />
      )}
      {deleteWait.isError && (
        <TaskWaitMutationError
          message={
            deleteWait.error instanceof Error
              ? deleteWait.error.message
              : 'Unable to remove the GitHub reply wait.'
          }
        />
      )}

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
            blockedBy: [
              ...blockedBy,
              { ...candidate, description: candidate.description ?? null },
            ],
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
        onSelectWait={(body) => {
          createWait.reset()
          setDialogOpen(false)
          setGithubWaitBlocker(null)
          setNewWaitBody(body)
          setNewWaitFollowUpDate(addLocalDays(formatLocalDate(new Date()), 3))
          setWaitDialogOpen(true)
        }}
      />

      <TaskWaitFormDialog
        open={waitDialogOpen}
        onOpenChange={(open) => {
          setWaitDialogOpen(open)
          if (!open) setGithubWaitBlocker(null)
        }}
        body={newWaitBody}
        followUpDate={newWaitFollowUpDate}
        title={githubWaitBlocker == null ? 'Wait for' : 'Wait for GitHub reply'}
        submitLabel={githubWaitBlocker == null ? 'Add' : 'Enable'}
        bodyRequired={githubWaitBlocker == null}
        onBodyChange={setNewWaitBody}
        onFollowUpDateChange={setNewWaitFollowUpDate}
        isPending={createWait.isPending}
        errorMessage={
          createWait.error instanceof Error
            ? createWait.error.message
            : undefined
        }
        onSubmit={() => {
          const input =
            githubWaitBlocker == null
              ? {
                  taskId,
                  body: newWaitBody,
                  followUpDate: newWaitFollowUpDate,
                }
              : {
                  taskId,
                  followUpDate: newWaitFollowUpDate,
                  githubUrl: githubWaitBlocker.url,
                  ...(newWaitBody.trim() === '' ? {} : { body: newWaitBody }),
                }
          createWait.mutate(input, {
            onSuccess: () => {
              setWaitDialogOpen(false)
              setGithubWaitBlocker(null)
            },
          })
        }}
      />
    </div>
  )
}

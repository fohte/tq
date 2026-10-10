import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Panel } from '@fohte/ui/panel'
import { Check, Hourglass, Plus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { GithubBlockerUpdateError } from '#components/task/github-blocker-update-error'
import { GitHubNotifyEventsPicker } from '#components/task/github-notify-events-picker'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import { TaskRowAppearance } from '#components/task/task-row-appearance'
import { TaskSearchCandidateDialog } from '#components/task/task-search-candidate-dialog'
import { TaskWaitFormDialog } from '#components/task/task-wait-form-dialog'
import { TaskWaitMutationError } from '#components/task/task-wait-mutation-error'
import { EditableMarkdownDescription } from '#components/ui/editable-markdown-description'
import { SectionHeading } from '#components/ui/section-heading'
import { useDebouncedSave } from '#hooks/use-debounced-save'
import type { GithubBlocker } from '#hooks/use-github-link'
import { useUpdateGithubLinkNotifyEvents } from '#hooks/use-github-link'
import type { SearchResult } from '#hooks/use-search'
import {
  useCreateTaskWait,
  useDeleteTaskWait,
  useResolveTaskWait,
  useUpdateTaskWait,
} from '#hooks/use-task-waits'
import type { LinkedTaskSummary, TaskWait } from '#hooks/use-tasks'
import { useUpdateTaskBlockedBy } from '#hooks/use-tasks'
import { addLocalDays, formatLocalDate } from '#lib/date-range'
import { formatShortDate } from '#lib/task-due-date'
import { cn } from '#lib/utils'

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
  const updateBlockedBy = useUpdateTaskBlockedBy()
  const updateNotifyEvents = useUpdateGithubLinkNotifyEvents(taskId)
  const createWait = useCreateTaskWait()
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
        {waits.map((wait) => (
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
              disabled={
                updateNotifyEvents.isPending || updateBlockedBy.isPending
              }
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
        onSelectWait={(body) => {
          createWait.reset()
          setDialogOpen(false)
          setNewWaitBody(body)
          setNewWaitFollowUpDate(addLocalDays(formatLocalDate(new Date()), 3))
          setWaitDialogOpen(true)
        }}
      />

      <TaskWaitFormDialog
        open={waitDialogOpen}
        onOpenChange={setWaitDialogOpen}
        body={newWaitBody}
        followUpDate={newWaitFollowUpDate}
        onBodyChange={setNewWaitBody}
        onFollowUpDateChange={setNewWaitFollowUpDate}
        isPending={createWait.isPending}
        errorMessage={
          createWait.error instanceof Error
            ? createWait.error.message
            : undefined
        }
        onSubmit={() => {
          createWait.mutate(
            {
              taskId,
              body: newWaitBody,
              followUpDate: newWaitFollowUpDate,
            },
            {
              onSuccess: () => {
                setWaitDialogOpen(false)
              },
            },
          )
        }}
      />
    </div>
  )
}

function TaskWaitEntry({ taskId, wait }: { taskId: string; wait: TaskWait }) {
  const [followUpDate, setFollowUpDate] = useState(wait.followUpDate)
  useEffect(() => {
    setFollowUpDate(wait.followUpDate)
  }, [wait.followUpDate])
  const updateWait = useUpdateTaskWait(taskId)
  const resolveWait = useResolveTaskWait(taskId)
  const deleteWait = useDeleteTaskWait(taskId)
  const { onChange, flush, cancel } = useDebouncedSave((body) => {
    updateWait.mutate({ waitId: wait.id, body })
  })
  const isResolved = wait.resolvedAt != null
  const disabled =
    updateWait.isPending || resolveWait.isPending || deleteWait.isPending
  const resolvedAt = wait.resolvedAt

  const saveFollowUpDate = () => {
    if (followUpDate === wait.followUpDate) return
    updateWait.mutate(
      { waitId: wait.id, followUpDate },
      {
        onError: () => {
          setFollowUpDate(wait.followUpDate)
        },
      },
    )
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 border-b border-border px-3 py-2 last:border-b-0',
        isResolved && 'opacity-55',
      )}
    >
      <div className="flex min-h-7 flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-muted-foreground">
        <Hourglass className="size-3.5 shrink-0" aria-hidden="true" />
        <span>{isResolved ? 'resolved' : 'waiting'}</span>
        {resolvedAt != null ? (
          <span className="ml-auto text-muted-foreground-faint">
            resolved {formatShortDate(formatLocalDate(new Date(resolvedAt)))}
          </span>
        ) : (
          <label className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground-faint">
            follow up
            <Input
              aria-label={`Follow-up date for ${wait.label}`}
              type="date"
              required
              value={followUpDate}
              disabled={disabled}
              onBlur={(event) => {
                if (
                  event.relatedTarget instanceof Element &&
                  event.relatedTarget.closest('[data-wait-action]') != null
                )
                  return
                saveFollowUpDate()
              }}
              onChange={(event) => {
                const nextFollowUpDate = event.target.value
                if (nextFollowUpDate !== '') {
                  setFollowUpDate(nextFollowUpDate)
                }
              }}
              className="h-7 w-32 border-0 bg-transparent p-0 font-mono text-xs text-muted-foreground underline decoration-border-strong underline-offset-2 focus-visible:ring-0"
            />
          </label>
        )}
        {!isResolved && (
          <Button
            type="button"
            variant="ghost"
            disabled={disabled}
            data-wait-action="resolve"
            onClick={() => {
              flush()
              saveFollowUpDate()
              resolveWait.mutate(wait.id)
            }}
            aria-label={`Resolve wait: ${wait.label}`}
            className="h-auto min-h-0 shrink-0 justify-start whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-mono text-xs font-normal text-muted-foreground shadow-none transition-none hover:bg-transparent hover:text-foreground active:translate-y-0"
          >
            <Check className="size-3.5" aria-hidden="true" />
            resolve
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={disabled}
          data-wait-action="remove"
          onClick={() => {
            cancel()
            deleteWait.mutate(wait.id)
          }}
          aria-label={`Remove wait: ${wait.label}`}
          className="shrink-0 text-muted-foreground-faint hover:text-destructive"
        >
          <X className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div
        className={cn(
          'pl-5 font-sans text-sm leading-relaxed',
          isResolved && 'text-muted-foreground line-through',
        )}
      >
        <EditableMarkdownDescription
          variant="inline"
          defaultValue={wait.body}
          placeholder="Add wait details..."
          editButtonLabel="Edit wait details"
          onChange={onChange}
          onExitEditMode={flush}
        />
      </div>
      {updateWait.isError && (
        <TaskWaitMutationError
          message={
            updateWait.error instanceof Error
              ? updateWait.error.message
              : 'Unable to update wait.'
          }
        />
      )}
      {resolveWait.isError && (
        <TaskWaitMutationError
          message={
            resolveWait.error instanceof Error
              ? resolveWait.error.message
              : 'Unable to resolve wait.'
          }
        />
      )}
      {deleteWait.isError && (
        <TaskWaitMutationError
          message={
            deleteWait.error instanceof Error
              ? deleteWait.error.message
              : 'Unable to remove wait.'
          }
        />
      )}
    </div>
  )
}

import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  DEFAULT_TASK_DESCRIPTION,
  useTaskDescriptionDraft,
} from '#components/task/create-task-modal-description'
import { CreateTaskModalDesktop } from '#components/task/create-task-modal-desktop'
import type {
  CommitmentValue,
  ContextValue,
  PlanValue,
} from '#components/task/create-task-modal-fields'
import { CreateTaskModalMobile } from '#components/task/create-task-modal-mobile'
import { createTaskModalTitleChangeHandler } from '#components/task/create-task-modal-title-change'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import { toGithubUrlSummary } from '#components/task/github-url-summary'
import { Button } from '#components/ui/button'
import { DeleteConfirmDialog } from '#components/ui/delete-confirm-dialog'
import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '#components/ui/dialog'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useCurrentContext } from '#hooks/use-current-context'
import { useLinkTaskToGithub } from '#hooks/use-github-link'
import { useGithubUrlPreview } from '#hooks/use-github-url-preview'
import {
  DAY_QUEUE_KEY,
  queueKeyForPlan,
  useQueueItems,
  useSetQueueItems,
  WEEK_QUEUE_KEY,
} from '#hooks/use-queues'
import { useTaskMentionPreview } from '#hooks/use-task-mentions'
import type { CreateTaskInput } from '#hooks/use-tasks'
import { useCreateTask } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { formatMinutes } from '#lib/format'
import { parseDurationToMinutes } from '#lib/parse-duration'
import type { ShorthandRecurrenceRule } from '#lib/task-shorthand'
import { cn } from '#lib/utils'

function estimateInputFor(minutes: number | undefined): string {
  return minutes != null ? formatMinutes(minutes) : ''
}

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStartDate?: string
  defaultDescription?: string
  defaultContext?: ContextValue
  defaultLabels?: string[]
  defaultEstimateMinutes?: number
  projectId?: string
  /** When set, the created task becomes a child of this task. */
  parentId?: string
  /** Shown as a read-only indicator that the task is a subtask; required
   * together with `parentTaskTitle` whenever `parentId` is set. */
  parentTaskNumber?: number
  parentTaskTitle?: string
  defaultDiscardConfirmationOpen?: boolean
  onCreated?: (task: { id: string }) => void
}

export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStartDate,
  defaultDescription,
  defaultContext,
  defaultLabels,
  defaultEstimateMinutes,
  projectId,
  parentId,
  parentTaskNumber,
  parentTaskTitle,
  defaultDiscardConfirmationOpen = false,
  onCreated,
}: CreateTaskModalProps) {
  const currentContext = useCurrentContext()
  const effectiveDefaultContext = defaultContext ?? currentContext

  const [title, setTitle] = useState('')
  const [discardConfirmationOpen, setDiscardConfirmationOpen] = useState(
    defaultDiscardConfirmationOpen,
  )
  const {
    getDescription,
    onChange: onDescriptionChange,
    onFocusedDocumentChange,
    reset: resetDescription,
  } = useTaskDescriptionDraft(defaultDescription)
  const [editorKey, setEditorKey] = useState(0)
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [dueDate, setDueDate] = useState('')
  const [estimateInput, setEstimateInput] = useState(
    estimateInputFor(defaultEstimateMinutes),
  )
  const [context, setContext] = useState<ContextValue | ''>(
    effectiveDefaultContext,
  )
  const [commitment, setCommitment] = useState<CommitmentValue | ''>('')
  const [plan, setPlan] = useState<PlanValue | ''>('')
  const [labels, setLabels] = useState<string[]>(defaultLabels ?? [])
  // Set when the user types a `^N` shorthand token, overriding the
  // parent passed in via props (e.g. from "Add subtask").
  const [parentOverrideNumber, setParentOverrideNumber] = useState<
    number | undefined
  >(undefined)
  // Set when the user types (or pastes) a GitHub issue/PR URL shorthand
  // token in the title.
  const [githubUrl, setGithubUrl] = useState<string | undefined>(undefined)
  const [recurrenceRule, setRecurrenceRule] = useState<
    ShorthandRecurrenceRule | undefined
  >(undefined)
  const createTask = useCreateTask()
  const linkGithub = useLinkTaskToGithub()
  const today = useMemo(() => formatLocalDate(new Date()), [])
  // Only fetched once a plan is actually chosen, since it's only needed to
  // append the new task to the end of the existing queue on submit.
  const dayItems = useQueueItems(DAY_QUEUE_KEY, today, {
    enabled: plan === 'day',
  })
  const weekItems = useQueueItems(WEEK_QUEUE_KEY, today, {
    enabled: plan === 'week',
  })
  const setQueueItems = useSetQueueItems()

  const parentOverridePreview = useTaskMentionPreview(
    parentOverrideNumber ?? 0,
    parentOverrideNumber != null,
  )
  const githubPreview = useGithubUrlPreview(githubUrl ?? '', githubUrl != null)
  const githubSummary = useMemo(
    () =>
      githubPreview.data != null
        ? toGithubUrlSummary(githubPreview.data)
        : null,
    [githubPreview.data],
  )
  const githubPending = githubUrl != null && githubPreview.data === undefined
  const githubUnresolvable = githubUrl != null && githubPreview.data === null
  const githubAlreadyLinked = githubSummary?.linkedTaskId != null

  // Seeds the title from the resolved issue/PR once, as an editable initial
  // value (not a re-applied transcription) — only while the title is still
  // empty, so it never clobbers text the user already typed.
  useEffect(() => {
    if (githubSummary == null) return
    setTitle((current) =>
      current.trim() === '' ? githubSummary.title : current,
    )
  }, [githubSummary])
  const effectiveParentNumber = parentOverrideNumber ?? parentTaskNumber
  const effectiveParentTitle =
    parentOverrideNumber != null
      ? parentOverridePreview.data?.title
      : parentTaskTitle
  const parentNotFound =
    parentOverrideNumber != null && parentOverridePreview.data === null
  const parentPending =
    parentOverrideNumber != null && parentOverridePreview.data === undefined
  // Sent as the raw number string, not `parentOverridePreview.data?.id`: the
  // API's taskIdOrNumber schema resolves a numeric string server-side.
  const effectiveParentId =
    parentOverrideNumber != null ? String(parentOverrideNumber) : parentId

  // Sync defaults when they change (e.g. a different row's "Add subtask" is
  // clicked) while the modal is closed, mirroring defaultStartDate below.
  useEffect(() => {
    if (!open) {
      setStartDate(defaultStartDate ?? '')
      setContext(effectiveDefaultContext)
      setLabels(defaultLabels ?? [])
      setEstimateInput(estimateInputFor(defaultEstimateMinutes))
    }
  }, [
    defaultStartDate,
    effectiveDefaultContext,
    defaultLabels,
    defaultEstimateMinutes,
    open,
  ])

  useEffect(() => {
    if (!open) setDiscardConfirmationOpen(false)
  }, [open])

  const parsedMinutes = parseDurationToMinutes(estimateInput)

  const resetForm = useCallback(() => {
    setTitle('')
    resetDescription()
    setEditorKey((k) => k + 1)
    setStartDate(defaultStartDate ?? '')
    setDueDate('')
    setEstimateInput(estimateInputFor(defaultEstimateMinutes))
    setContext(effectiveDefaultContext)
    setCommitment('')
    setPlan('')
    setLabels(defaultLabels ?? [])
    setParentOverrideNumber(undefined)
    setGithubUrl(undefined)
    setRecurrenceRule(undefined)
  }, [
    defaultStartDate,
    effectiveDefaultContext,
    defaultLabels,
    defaultEstimateMinutes,
    resetDescription,
  ])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        const description = getDescription()
        if (title.trim() !== '' || description.trim() !== '') {
          setDiscardConfirmationOpen(true)
          return
        }
        resetForm()
      }
      onOpenChange(nextOpen)
    },
    [getDescription, onOpenChange, resetForm, title],
  )

  const discardDraft = () => {
    setDiscardConfirmationOpen(false)
    resetForm()
    onOpenChange(false)
  }

  const handleTitleChange = createTaskModalTitleChangeHandler({
    setTitle,
    setStartDate,
    setDueDate,
    setEstimateInput,
    setContext,
    setLabels,
    setParentOverrideNumber,
    setGithubUrl,
    setPlan,
    setRecurrenceRule,
  })

  // Blocks submit until the relevant queue's current items have loaded —
  // otherwise the queue-append below would send only the new task's ID,
  // and PUT /api/queues/:key/items replaces the queue's contents wholesale.
  const planQueueLoading =
    (plan === 'day' && dayItems.data === undefined) ||
    (plan === 'week' && weekItems.data === undefined)

  const canSubmit =
    title.trim() !== '' &&
    !createTask.isPending &&
    !planQueueLoading &&
    !parentNotFound &&
    !parentPending &&
    !githubPending &&
    !githubUnresolvable &&
    !githubAlreadyLinked

  // Choosing today/this week already means triage is done, so it implies
  // commitment: active unless the user picked one explicitly.
  const effectiveCommitment: CommitmentValue | '' =
    commitment || (plan !== '' ? 'active' : '')

  const handleSubmit = () => {
    if (!canSubmit) return

    const desc = getDescription().trim()
    const input: CreateTaskInput = {
      title: title.trim(),
      ...(desc ? { description: desc } : {}),
      ...(startDate ? { startDate } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(parsedMinutes != null ? { estimatedMinutes: parsedMinutes } : {}),
      ...(context ? { context } : {}),
      ...(effectiveCommitment ? { commitment: effectiveCommitment } : {}),
      ...(labels.length > 0 ? { labels } : {}),
      ...(projectId != null ? { projectId } : {}),
      ...(effectiveParentId != null ? { parentId: effectiveParentId } : {}),
      ...(recurrenceRule != null ? { recurrenceRule } : {}),
    }

    createTask.mutate(input, {
      onSuccess: (task) => {
        if (githubUrl != null) {
          linkGithub.mutate(
            { taskId: task.id, url: githubUrl },
            {
              onError: (error) => {
                console.error('Failed to link task to GitHub', error)
              },
            },
          )
        }
        if (plan !== '') {
          const key = queueKeyForPlan(plan)
          const items = plan === 'day' ? dayItems.data : weekItems.data
          setQueueItems.mutate(
            {
              key,
              date: today,
              taskIds: [...(items ?? []).map((item) => item.taskId), task.id],
            },
            {
              onError: (error) => {
                console.error('Failed to add task to queue', error)
              },
            },
          )
        }
        setDiscardConfirmationOpen(false)
        resetForm()
        onOpenChange(false)
        onCreated?.(task)
      },
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const estimateLabel =
    parsedMinutes != null
      ? formatMinutes(parsedMinutes)
      : estimateInput || 'Estimate'

  const parentIndicator = effectiveParentNumber != null && (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-2xs',
        parentNotFound ? 'text-destructive' : 'text-muted-foreground-faint',
      )}
    >
      {parentNotFound ? (
        <>parent #{effectiveParentNumber} not found</>
      ) : (
        <>
          subtask of #{effectiveParentNumber} {effectiveParentTitle}
        </>
      )}
      {parentOverrideNumber != null && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setParentOverrideNumber(undefined)
          }}
          aria-label="Remove parent override"
          className="h-auto min-h-0 shrink whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 text-muted-foreground-faint hover:text-destructive"
        >
          <X className="size-2.5" />
        </Button>
      )}
    </span>
  )

  const githubIndicator = githubUrl != null && (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-2xs',
        githubUnresolvable || githubAlreadyLinked
          ? 'text-destructive'
          : 'text-muted-foreground-faint',
      )}
    >
      {githubPending ? (
        <>resolving {githubUrl}...</>
      ) : githubUnresolvable ? (
        <>could not resolve GitHub link</>
      ) : githubAlreadyLinked ? (
        <>already linked to another task</>
      ) : (
        githubSummary && <GithubRefSummary {...githubSummary} />
      )}
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          setGithubUrl(undefined)
        }}
        aria-label="Remove GitHub link"
        className="h-auto min-h-0 shrink whitespace-normal gap-0 rounded-none border-0 bg-transparent p-0 font-normal shadow-none transition-none hover:bg-transparent active:translate-y-0 text-muted-foreground-faint hover:text-destructive"
      >
        <X className="size-2.5" />
      </Button>
    </span>
  )

  const descriptionEditor = (
    <MarkdownEditor
      key={editorKey}
      defaultValue={defaultDescription ?? DEFAULT_TASK_DESCRIPTION}
      placeholder="Add description..."
      onChange={onDescriptionChange}
      onFocusedDocumentChange={onFocusedDocumentChange}
      size="compact"
    />
  )

  const submitDisabled = !canSubmit

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPopup onKeyDown={handleKeyDown}>
          <CreateTaskModalDesktop
            parentIndicator={parentIndicator}
            githubIndicator={githubIndicator}
            descriptionEditor={descriptionEditor}
            title={title}
            setTitle={handleTitleChange}
            startDate={startDate}
            setStartDate={setStartDate}
            dueDate={dueDate}
            setDueDate={setDueDate}
            estimateInput={estimateInput}
            setEstimateInput={setEstimateInput}
            context={context}
            setContext={setContext}
            commitment={commitment}
            setCommitment={setCommitment}
            plan={plan}
            setPlan={setPlan}
            labels={labels}
            setLabels={setLabels}
            handleOpenChange={handleOpenChange}
            handleSubmit={handleSubmit}
            submitDisabled={submitDisabled}
          />
          <CreateTaskModalMobile
            parentIndicator={parentIndicator}
            githubIndicator={githubIndicator}
            descriptionEditor={descriptionEditor}
            title={title}
            setTitle={handleTitleChange}
            startDate={startDate}
            setStartDate={setStartDate}
            dueDate={dueDate}
            setDueDate={setDueDate}
            estimateInput={estimateInput}
            setEstimateInput={setEstimateInput}
            estimateLabel={estimateLabel}
            estimateActive={parsedMinutes != null}
            context={context}
            setContext={setContext}
            commitment={commitment}
            setCommitment={setCommitment}
            plan={plan}
            setPlan={setPlan}
            labels={labels}
            setLabels={setLabels}
            handleOpenChange={handleOpenChange}
            handleSubmit={handleSubmit}
            submitDisabled={submitDisabled}
          />
        </DialogPopup>
      </DialogPortal>
      <DeleteConfirmDialog
        title="Discard task draft?"
        description="The task and its description will be discarded."
        confirmLabel="Discard"
        onConfirm={discardDraft}
        open={open && discardConfirmationOpen}
        onOpenChange={setDiscardConfirmationOpen}
      />
    </Dialog>
  )
}

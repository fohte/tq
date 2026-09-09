import { X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { CreateTaskModalDesktop } from '#components/task/create-task-modal-desktop'
import type {
  CommitmentValue,
  ContextValue,
} from '#components/task/create-task-modal-fields'
import { CreateTaskModalMobile } from '#components/task/create-task-modal-mobile'
import { GithubRefSummary } from '#components/task/github-ref-summary'
import { toGithubUrlSummary } from '#components/task/github-url-summary'
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
import { useTaskMentionPreview } from '#hooks/use-task-mentions'
import type { CreateTaskInput } from '#hooks/use-tasks'
import { useCreateTask } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { parseDurationToMinutes } from '#lib/parse-duration'
import {
  extractShorthandTokens,
  type ShorthandRecurrenceRule,
} from '#lib/task-shorthand'
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
  onCreated,
}: CreateTaskModalProps) {
  const currentContext = useCurrentContext()
  const effectiveDefaultContext = defaultContext ?? currentContext

  const [title, setTitle] = useState('')
  const descriptionRef = useRef('')
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
  const [labels, setLabels] = useState<string[]>(defaultLabels ?? [])
  // Set when the user types a `^N` shorthand token, overriding the
  // parent passed in via props (e.g. from "Add subtask").
  const [parentOverrideNumber, setParentOverrideNumber] = useState<
    number | undefined
  >(undefined)
  // Set when the user types (or pastes) a GitHub issue/PR URL shorthand
  // token in the title.
  const [githubUrl, setGithubUrl] = useState<string | undefined>(undefined)
  // Set when the user types a `*daily`/`*weekly`/`*sun`... shorthand token.
  const [recurrenceRule, setRecurrenceRule] = useState<
    ShorthandRecurrenceRule | undefined
  >(undefined)
  const createTask = useCreateTask()
  const linkGithub = useLinkTaskToGithub()

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

  const parsedMinutes = parseDurationToMinutes(estimateInput)

  const resetForm = useCallback(() => {
    setTitle('')
    descriptionRef.current = ''
    setEditorKey((k) => k + 1)
    setStartDate(defaultStartDate ?? '')
    setDueDate('')
    setEstimateInput(estimateInputFor(defaultEstimateMinutes))
    setContext(effectiveDefaultContext)
    setCommitment('')
    setLabels(defaultLabels ?? [])
    setParentOverrideNumber(undefined)
    setGithubUrl(undefined)
    setRecurrenceRule(undefined)
  }, [
    defaultStartDate,
    effectiveDefaultContext,
    defaultLabels,
    defaultEstimateMinutes,
  ])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  // Stripping a consumed token resets the input's caret to the end of the
  // (now shorter) title, since the value change isn't a plain append. Fine
  // for the common case of appending a shorthand token while typing; jarring
  // if a token is completed with the caret positioned mid-title.
  const handleTitleChange = (value: string) => {
    const parsed = extractShorthandTokens(value)
    setTitle(parsed.title)
    if (parsed.startDate != null) setStartDate(parsed.startDate)
    if (parsed.dueDate != null) setDueDate(parsed.dueDate)
    if (parsed.estimateInput != null) setEstimateInput(parsed.estimateInput)
    if (parsed.context != null) setContext(parsed.context)
    if (parsed.labels.length > 0) {
      setLabels((prev) => [...new Set([...prev, ...parsed.labels])])
    }
    if (parsed.parentNumber != null)
      setParentOverrideNumber(parsed.parentNumber)
    if (parsed.githubUrl != null) setGithubUrl(parsed.githubUrl)
    if (parsed.recurrenceRule != null) setRecurrenceRule(parsed.recurrenceRule)
  }

  const canSubmit =
    title.trim() !== '' &&
    !createTask.isPending &&
    !parentNotFound &&
    !parentPending &&
    !githubPending &&
    !githubUnresolvable &&
    !githubAlreadyLinked

  const handleSubmit = () => {
    if (!canSubmit) return

    const desc = descriptionRef.current.trim()
    const input: CreateTaskInput = {
      title: title.trim(),
      ...(desc ? { description: desc } : {}),
      ...(startDate ? { startDate } : {}),
      ...(dueDate ? { dueDate } : {}),
      ...(parsedMinutes != null ? { estimatedMinutes: parsedMinutes } : {}),
      ...(context ? { context } : {}),
      ...(commitment ? { commitment } : {}),
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
        <button
          type="button"
          onClick={() => {
            setParentOverrideNumber(undefined)
          }}
          aria-label="Remove parent override"
          className="text-muted-foreground-faint hover:text-destructive"
        >
          <X className="h-2.5 w-2.5" />
        </button>
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
      <button
        type="button"
        onClick={() => {
          setGithubUrl(undefined)
        }}
        aria-label="Remove GitHub link"
        className="text-muted-foreground-faint hover:text-destructive"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </span>
  )

  const descriptionEditor = (
    <MarkdownEditor
      key={editorKey}
      defaultValue={defaultDescription ?? '## Why\n\n## What'}
      placeholder="Add description..."
      onChange={(md) => {
        descriptionRef.current = md
      }}
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
            labels={labels}
            setLabels={setLabels}
            handleOpenChange={handleOpenChange}
            handleSubmit={handleSubmit}
            submitDisabled={submitDisabled}
          />
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

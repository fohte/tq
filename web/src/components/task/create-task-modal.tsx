import { useCallback, useEffect, useRef, useState } from 'react'

import { CreateTaskModalDesktop } from '#components/task/create-task-modal-desktop'
import type {
  CommitmentValue,
  ContextValue,
} from '#components/task/create-task-modal-fields'
import { CreateTaskModalMobile } from '#components/task/create-task-modal-mobile'
import {
  Dialog,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '#components/ui/dialog'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import { useCurrentContext } from '#hooks/use-current-context'
import type { CreateTaskInput } from '#hooks/use-tasks'
import { useCreateTask } from '#hooks/use-tasks'
import { formatMinutes } from '#lib/format'
import { parseDurationToMinutes } from '#lib/parse-duration'

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStartDate?: string
  defaultDescription?: string
  defaultContext?: ContextValue
  defaultLabels?: string[]
  projectId?: string
  /** When set, the created task becomes a child of this task. */
  parentId?: string
  /** Shown as a read-only indicator that the task is a subtask; required
   * together with `parentTaskTitle` whenever `parentId` is set. */
  parentTaskNumber?: number
  parentTaskTitle?: string
}

export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStartDate,
  defaultDescription,
  defaultContext,
  defaultLabels,
  projectId,
  parentId,
  parentTaskNumber,
  parentTaskTitle,
}: CreateTaskModalProps) {
  // Falls back to this machine's context (settings > session open) when the
  // caller has no more specific default (e.g. an inherited parent context).
  const currentContext = useCurrentContext()
  const effectiveDefaultContext = defaultContext ?? currentContext

  const [title, setTitle] = useState('')
  const descriptionRef = useRef('')
  const [editorKey, setEditorKey] = useState(0)
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [dueDate, setDueDate] = useState('')
  const [estimateInput, setEstimateInput] = useState('')
  const [context, setContext] = useState<ContextValue | ''>(
    effectiveDefaultContext,
  )
  const [commitment, setCommitment] = useState<CommitmentValue | ''>('')
  const [labels, setLabels] = useState<string[]>(defaultLabels ?? [])
  const createTask = useCreateTask()

  // Sync defaults when they change (e.g. a different row's "Add subtask" is
  // clicked) while the modal is closed, mirroring defaultStartDate below.
  useEffect(() => {
    if (!open) {
      setStartDate(defaultStartDate ?? '')
      setContext(effectiveDefaultContext)
      setLabels(defaultLabels ?? [])
    }
  }, [defaultStartDate, effectiveDefaultContext, defaultLabels, open])

  const parsedMinutes = parseDurationToMinutes(estimateInput)

  const resetForm = useCallback(() => {
    setTitle('')
    descriptionRef.current = ''
    setEditorKey((k) => k + 1)
    setStartDate(defaultStartDate ?? '')
    setDueDate('')
    setEstimateInput('')
    setContext(effectiveDefaultContext)
    setCommitment('')
    setLabels(defaultLabels ?? [])
  }, [defaultStartDate, effectiveDefaultContext, defaultLabels])

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        resetForm()
      }
      onOpenChange(nextOpen)
    },
    [onOpenChange, resetForm],
  )

  const handleSubmit = () => {
    if (!title.trim() || createTask.isPending) return

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
      ...(parentId != null ? { parentId } : {}),
    }

    createTask.mutate(input, {
      onSuccess: () => {
        resetForm()
        onOpenChange(false)
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

  const parentIndicator = parentTaskNumber != null && (
    <span className="font-mono text-2xs text-muted-foreground-faint">
      subtask of #{parentTaskNumber} {parentTaskTitle}
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

  const submitDisabled = !title.trim() || createTask.isPending

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPopup onKeyDown={handleKeyDown}>
          <CreateTaskModalDesktop
            parentIndicator={parentIndicator}
            descriptionEditor={descriptionEditor}
            title={title}
            setTitle={setTitle}
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
            descriptionEditor={descriptionEditor}
            title={title}
            setTitle={setTitle}
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

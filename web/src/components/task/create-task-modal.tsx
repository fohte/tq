import { Button } from '@web/components/ui/button'
import { Dialog, DialogOverlay, DialogPortal } from '@web/components/ui/dialog'
import { MarkdownEditor } from '@web/components/ui/markdown-editor'
import type { CreateTaskInput } from '@web/hooks/use-tasks'
import { useCreateTask } from '@web/hooks/use-tasks'
import { formatMinutes, parseDurationToMinutes } from '@web/lib/parse-duration'
import { cn } from '@web/lib/utils'
import { Calendar, CalendarPlus, Clock, Layers, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStartDate?: string
  defaultDescription?: string
}

type ContextValue = 'work' | 'personal' | 'dev'

const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
  dev: 'Dev',
}

export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStartDate,
  defaultDescription,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const descriptionRef = useRef('')
  const [editorKey, setEditorKey] = useState(0)
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [dueDate, setDueDate] = useState('')
  const [estimateInput, setEstimateInput] = useState('')
  const [context, setContext] = useState<ContextValue | ''>('')
  const createTask = useCreateTask()

  // Sync startDate when defaultStartDate prop changes (e.g. tab switch)
  useEffect(() => {
    if (!open) {
      setStartDate(defaultStartDate ?? '')
    }
  }, [defaultStartDate, open])

  const parsedMinutes = parseDurationToMinutes(estimateInput)

  const resetForm = useCallback(() => {
    setTitle('')
    descriptionRef.current = ''
    setEditorKey((k) => k + 1)
    setStartDate(defaultStartDate ?? '')
    setDueDate('')
    setEstimateInput('')
    setContext('')
  }, [defaultStartDate])

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

  const descriptionEditor = (
    <MarkdownEditor
      key={editorKey}
      defaultValue={defaultDescription ?? '## Why\n\n## What'}
      placeholder="Add description..."
      onChange={(md) => {
        descriptionRef.current = md
      }}
    />
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        {/* PC Modal */}
        <div
          className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex"
          onKeyDown={handleKeyDown}
        >
          <div className="flex max-h-full w-full max-w-[600px] flex-col overflow-hidden rounded-2xl bg-card shadow-2xl ring-1 ring-foreground/10">
            {/* Header */}
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
              <span className="text-base font-semibold text-foreground">
                New Task
              </span>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Body (scrollable) */}
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
                className="w-full bg-transparent text-xl font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />

              {/* Description (WYSIWYG) */}
              <div className="max-h-[40vh] min-h-[160px] overflow-y-auto rounded-lg border border-border p-1 text-sm focus-within:border-primary/50">
                {descriptionEditor}
              </div>

              {/* Option fields */}
              <div className="flex flex-wrap items-end gap-4">
                <FieldGroup
                  label="Start"
                  icon={<CalendarPlus className="size-3.5" />}
                >
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-32 bg-transparent text-xs text-foreground outline-none"
                  />
                </FieldGroup>
                <FieldGroup
                  label="Due"
                  icon={<Calendar className="size-3.5" />}
                >
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-32 bg-transparent text-xs text-foreground outline-none"
                  />
                </FieldGroup>
                <FieldGroup
                  label="Estimate"
                  icon={<Clock className="size-3.5" />}
                >
                  <input
                    type="text"
                    value={estimateInput}
                    onChange={(e) => setEstimateInput(e.target.value)}
                    placeholder="1h30m"
                    className="w-16 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                  />
                </FieldGroup>
                <FieldGroup
                  label="Context"
                  icon={<Layers className="size-3.5" />}
                >
                  <select
                    value={context}
                    onChange={(e) =>
                      setContext(e.target.value as ContextValue | '')
                    }
                    className="bg-transparent text-xs text-foreground outline-none"
                  >
                    <option value="">—</option>
                    <option value="work">Work</option>
                    <option value="personal">Personal</option>
                    <option value="dev">Dev</option>
                  </select>
                </FieldGroup>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                Cancel
              </button>
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || createTask.isPending}
                className="h-9 rounded-lg px-4"
              >
                Create Task
              </Button>
            </div>
          </div>
        </div>

        {/* SP Modal (bottom sheet) */}
        <div
          className="fixed inset-0 z-50 flex items-end md:hidden"
          onKeyDown={handleKeyDown}
        >
          <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-xl bg-card pb-5 shadow-2xl ring-1 ring-foreground/10">
            {/* Header */}
            <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-border bg-card px-4">
              <span className="text-base font-semibold text-foreground">
                New Task
              </span>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex flex-col gap-4 px-5 pt-4">
              {/* Title */}
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="タスクのタイトル"
                autoFocus
                className="w-full bg-transparent text-lg font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />

              {/* Description (WYSIWYG) */}
              <div className="max-h-[30vh] min-h-[80px] overflow-y-auto text-[15px]">
                {descriptionEditor}
              </div>

              <div className="h-px bg-border" />

              {/* Chip row */}
              <div className="flex gap-2 overflow-x-auto">
                <SpChip
                  icon={<CalendarPlus className="size-3.5" />}
                  label={startDate || 'Start'}
                  active={!!startDate}
                  expanded={
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      autoFocus
                      className="w-28 bg-transparent text-xs outline-none"
                    />
                  }
                />
                <SpChip
                  icon={<Clock className="size-3.5" />}
                  label={estimateLabel}
                  active={parsedMinutes != null}
                  expanded={
                    <input
                      type="text"
                      value={estimateInput}
                      onChange={(e) => setEstimateInput(e.target.value)}
                      placeholder="1h30m"
                      autoFocus
                      className="w-14 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                    />
                  }
                />
                <SpChip
                  icon={<Calendar className="size-3.5" />}
                  label={dueDate || 'Due'}
                  active={!!dueDate}
                  expanded={
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      autoFocus
                      className="w-28 bg-transparent text-xs outline-none"
                    />
                  }
                />
                <SpChip
                  icon={<Layers className="size-3.5" />}
                  label={context ? contextLabels[context] : 'Context'}
                  active={!!context}
                  expanded={
                    <select
                      value={context}
                      onChange={(e) =>
                        setContext(e.target.value as ContextValue | '')
                      }
                      autoFocus
                      className="bg-transparent text-xs outline-none"
                    >
                      <option value="">None</option>
                      <option value="work">Work</option>
                      <option value="personal">Personal</option>
                      <option value="dev">Dev</option>
                    </select>
                  }
                />
              </div>

              {/* Create button */}
              <Button
                onClick={handleSubmit}
                disabled={!title.trim() || createTask.isPending}
                className="h-12 w-full rounded-lg text-base font-semibold"
              >
                Create
              </Button>
            </div>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

function FieldGroup({
  label,
  icon,
  children,
}: {
  label: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className="flex h-7 items-center rounded-md border border-border px-2 text-xs focus-within:border-primary/50">
        {children}
      </div>
    </div>
  )
}

function SpChip({
  icon,
  label,
  active,
  expanded,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  expanded?: React.ReactNode
}) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-secondary text-muted-foreground',
      )}
    >
      {icon}
      {isEditing && expanded ? (
        <div onBlur={() => setIsEditing(false)}>{expanded}</div>
      ) : (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          className="outline-none"
        >
          {label}
        </button>
      )}
    </div>
  )
}

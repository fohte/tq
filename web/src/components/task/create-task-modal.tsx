import {
  Calendar,
  CalendarPlus,
  Clock,
  Inbox,
  Layers,
  Tag,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { TagsInput } from '#components/task/tags-input'
import {
  BottomSheetHeader,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'
import {
  Dialog,
  DialogHeaderBar,
  DialogOverlay,
  DialogPopup,
  DialogPortal,
} from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import { MarkdownEditor } from '#components/ui/markdown-editor'
import {
  ExpandableFieldChip,
  InlineFieldGroup,
} from '#components/ui/modal-field'
import { ModalPanel } from '#components/ui/modal-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import type { CreateTaskInput } from '#hooks/use-tasks'
import { useCreateTask } from '#hooks/use-tasks'
import { selectValueHandler } from '#lib/form-utils'
import { formatMinutes } from '#lib/format'
import { parseDurationToMinutes } from '#lib/parse-duration'

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultStartDate?: string
  defaultDescription?: string
  projectId?: string
}

type ContextValue = 'work' | 'personal'
const contextValues = ['', 'work', 'personal'] as const satisfies readonly (
  ContextValue | ''
)[]

const contextLabels: Record<ContextValue, string> = {
  work: 'Work',
  personal: 'Personal',
}

type CommitmentValue = 'inbox' | 'active' | 'someday'
const commitmentValues = [
  '',
  'inbox',
  'active',
  'someday',
] as const satisfies readonly (CommitmentValue | '')[]

const commitmentLabels: Record<CommitmentValue, string> = {
  inbox: 'Inbox',
  active: 'Active',
  someday: 'Someday',
}

export function CreateTaskModal({
  open,
  onOpenChange,
  defaultStartDate,
  defaultDescription,
  projectId,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('')
  const descriptionRef = useRef('')
  const [editorKey, setEditorKey] = useState(0)
  const [startDate, setStartDate] = useState(defaultStartDate ?? '')
  const [dueDate, setDueDate] = useState('')
  const [estimateInput, setEstimateInput] = useState('')
  const [context, setContext] = useState<ContextValue | ''>('')
  const [commitment, setCommitment] = useState<CommitmentValue | ''>('')
  const [labels, setLabels] = useState<string[]>([])
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
    setCommitment('')
    setLabels([])
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
      ...(commitment ? { commitment } : {}),
      ...(labels.length > 0 ? { labels } : {}),
      ...(projectId != null ? { projectId } : {}),
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
      size="compact"
    />
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="bg-black/40" />
        <DialogPopup onKeyDown={handleKeyDown}>
          {/* PC Modal */}
          <div className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
            <ModalPanel>
              {/* Header */}
              <DialogHeaderBar>
                <span className="text-base font-semibold text-foreground">
                  New Task
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                  className="text-muted-foreground"
                >
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </DialogHeaderBar>

              {/* Body (scrollable) */}
              <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
                {/* Title */}
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                  }}
                  placeholder="Task title"
                  autoFocus
                  className="h-auto border-0 bg-transparent p-0 text-xl font-medium text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0 md:text-xl"
                />

                {/* Description (WYSIWYG) */}
                <div className="max-h-modal-composer overflow-y-auto rounded-lg border border-border p-1 text-sm focus-within:border-primary/50">
                  {descriptionEditor}
                </div>

                {/* Option fields */}
                <div className="flex flex-wrap items-end gap-4">
                  <InlineFieldGroup
                    label="Start"
                    icon={<CalendarPlus className="size-3.5" />}
                  >
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                      }}
                      className="h-auto w-32 border-0 bg-transparent p-0 text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
                    />
                  </InlineFieldGroup>
                  <InlineFieldGroup
                    label="Due"
                    icon={<Calendar className="size-3.5" />}
                  >
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => {
                        setDueDate(e.target.value)
                      }}
                      className="h-auto w-32 border-0 bg-transparent p-0 text-xs text-foreground shadow-none focus-visible:border-0 focus-visible:ring-0"
                    />
                  </InlineFieldGroup>
                  <InlineFieldGroup
                    label="Estimate"
                    icon={<Clock className="size-3.5" />}
                  >
                    <Input
                      type="text"
                      value={estimateInput}
                      onChange={(e) => {
                        setEstimateInput(e.target.value)
                      }}
                      placeholder="1h30m"
                      className="h-auto w-16 border-0 bg-transparent p-0 text-xs text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
                    />
                  </InlineFieldGroup>
                  <InlineFieldGroup
                    label="Context"
                    icon={<Layers className="size-3.5" />}
                  >
                    <Select
                      value={context}
                      onValueChange={selectValueHandler(
                        setContext,
                        contextValues,
                      )}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      >
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">—</SelectItem>
                        <SelectItem value="work">Work</SelectItem>
                        <SelectItem value="personal">Personal</SelectItem>
                      </SelectContent>
                    </Select>
                  </InlineFieldGroup>
                  <InlineFieldGroup
                    label="Commitment"
                    icon={<Inbox className="size-3.5" />}
                  >
                    <Select
                      value={commitment}
                      onValueChange={selectValueHandler(
                        setCommitment,
                        commitmentValues,
                      )}
                    >
                      <SelectTrigger
                        size="sm"
                        className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                      >
                        <SelectValue placeholder="Inbox" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Inbox</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="someday">Someday</SelectItem>
                      </SelectContent>
                    </Select>
                  </InlineFieldGroup>
                </div>

                {/* Tags */}
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
                    <Tag className="size-3.5" />
                    TAGS
                  </span>
                  <TagsInput labels={labels} onLabelsChange={setLabels} />
                </div>
              </div>

              {/* Footer */}
              <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-6 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || createTask.isPending}
                  className="h-9 rounded-lg px-4"
                >
                  Create Task
                </Button>
              </div>
            </ModalPanel>
          </div>

          {/* SP Modal (bottom sheet) */}
          <div className="fixed inset-0 z-50 flex items-end md:hidden">
            <BottomSheetPanel>
              {/* Header */}
              <BottomSheetHeader>
                <span className="text-base font-semibold text-foreground">
                  New Task
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    handleOpenChange(false)
                  }}
                  className="text-muted-foreground"
                >
                  <X className="size-5" />
                  <span className="sr-only">Close</span>
                </Button>
              </BottomSheetHeader>

              {/* Content */}
              <div className="flex flex-col gap-4 px-5 pt-4">
                {/* Title */}
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                  }}
                  placeholder="タスクのタイトル"
                  autoFocus
                  className="h-auto border-0 bg-transparent p-0 text-lg font-medium text-foreground shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
                />

                {/* Description (WYSIWYG) */}
                <div className="max-h-sheet-composer overflow-y-auto text-sm">
                  {descriptionEditor}
                </div>

                <div className="h-px bg-border" />

                {/* Chip row */}
                <div className="flex gap-2 overflow-x-auto">
                  <ExpandableFieldChip
                    icon={<CalendarPlus className="size-3.5" />}
                    label={startDate || 'Start'}
                    active={!!startDate}
                    expanded={() => (
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => {
                          setStartDate(e.target.value)
                        }}
                        autoFocus
                        className="h-auto w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:border-0 focus-visible:ring-0"
                      />
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Clock className="size-3.5" />}
                    label={estimateLabel}
                    active={parsedMinutes != null}
                    expanded={() => (
                      <Input
                        type="text"
                        value={estimateInput}
                        onChange={(e) => {
                          setEstimateInput(e.target.value)
                        }}
                        placeholder="1h30m"
                        autoFocus
                        className="h-auto w-14 border-0 bg-transparent p-0 text-xs shadow-none placeholder:text-muted-foreground focus-visible:border-0 focus-visible:ring-0"
                      />
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Calendar className="size-3.5" />}
                    label={dueDate || 'Due'}
                    active={!!dueDate}
                    expanded={() => (
                      <Input
                        type="date"
                        value={dueDate}
                        onChange={(e) => {
                          setDueDate(e.target.value)
                        }}
                        autoFocus
                        className="h-auto w-28 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:border-0 focus-visible:ring-0"
                      />
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Layers className="size-3.5" />}
                    label={context ? contextLabels[context] : 'Context'}
                    active={!!context}
                    expanded={(close) => (
                      <Select
                        value={context}
                        onValueChange={(value) => {
                          selectValueHandler(setContext, contextValues)(value)
                          close()
                        }}
                      >
                        <SelectTrigger
                          autoFocus
                          size="sm"
                          className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        >
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          <SelectItem value="work">Work</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <ExpandableFieldChip
                    icon={<Inbox className="size-3.5" />}
                    label={commitment ? commitmentLabels[commitment] : 'Inbox'}
                    active={!!commitment}
                    expanded={(close) => (
                      <Select
                        value={commitment}
                        onValueChange={(value) => {
                          selectValueHandler(
                            setCommitment,
                            commitmentValues,
                          )(value)
                          close()
                        }}
                      >
                        <SelectTrigger
                          autoFocus
                          size="sm"
                          className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                        >
                          <SelectValue placeholder="Inbox" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Inbox</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="someday">Someday</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                {/* Tags */}
                <TagsInput labels={labels} onLabelsChange={setLabels} />

                {/* Create button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!title.trim() || createTask.isPending}
                  className="h-12 w-full rounded-lg text-base font-semibold"
                >
                  Create
                </Button>
              </div>
            </BottomSheetPanel>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  )
}

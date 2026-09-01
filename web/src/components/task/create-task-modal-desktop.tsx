import {
  Calendar,
  CalendarPlus,
  Clock,
  Inbox,
  Layers,
  Tag,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'

import {
  type CommitmentValue,
  commitmentValues,
  type ContextValue,
  contextValues,
} from '#components/task/create-task-modal-fields'
import { TagsInput } from '#components/task/tags-input'
import { Button } from '#components/ui/button'
import { DialogHeaderBar } from '#components/ui/dialog'
import { Input } from '#components/ui/input'
import { InlineFieldGroup } from '#components/ui/modal-field'
import { ModalPanel } from '#components/ui/modal-panel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { selectValueHandler } from '#lib/form-utils'

export function CreateTaskModalDesktop({
  parentIndicator,
  descriptionEditor,
  title,
  setTitle,
  startDate,
  setStartDate,
  dueDate,
  setDueDate,
  estimateInput,
  setEstimateInput,
  context,
  setContext,
  commitment,
  setCommitment,
  labels,
  setLabels,
  handleOpenChange,
  handleSubmit,
  submitDisabled,
}: {
  parentIndicator: ReactNode
  descriptionEditor: ReactNode
  title: string
  setTitle: (value: string) => void
  startDate: string
  setStartDate: (value: string) => void
  dueDate: string
  setDueDate: (value: string) => void
  estimateInput: string
  setEstimateInput: (value: string) => void
  context: ContextValue | ''
  setContext: (value: ContextValue | '') => void
  commitment: CommitmentValue | ''
  setCommitment: (value: CommitmentValue | '') => void
  labels: string[]
  setLabels: (labels: string[]) => void
  handleOpenChange: (open: boolean) => void
  handleSubmit: () => void
  submitDisabled: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
      <ModalPanel>
        {/* Header */}
        <DialogHeaderBar>
          <div className="flex flex-col">
            <span className="text-base font-semibold text-foreground">
              New Task
            </span>
            {parentIndicator}
          </div>
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
                onValueChange={selectValueHandler(setContext, contextValues)}
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
            disabled={submitDisabled}
            className="h-9 rounded-lg px-4"
          >
            Create Task
          </Button>
        </div>
      </ModalPanel>
    </div>
  )
}

import { Calendar, CalendarPlus, Clock, Inbox, Layers, X } from 'lucide-react'
import type { ReactNode } from 'react'

import {
  commitmentLabels,
  type CommitmentValue,
  commitmentValues,
  contextLabels,
  type ContextValue,
  contextValues,
} from '#components/task/create-task-modal-fields'
import { TagsInput } from '#components/task/tags-input'
import {
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import { ExpandableFieldChip } from '#components/ui/modal-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { selectValueHandler } from '#lib/form-utils'

export function CreateTaskModalMobile({
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
  estimateLabel,
  estimateActive,
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
  estimateLabel: string
  estimateActive: boolean
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
    <BottomSheetOverlay className="md:hidden">
      <BottomSheetPanel>
        {/* Header */}
        <BottomSheetHeader>
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
              active={estimateActive}
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
                    selectValueHandler(setCommitment, commitmentValues)(value)
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
            disabled={submitDisabled}
            className="h-12 w-full rounded-lg text-base font-semibold"
          >
            Create
          </Button>
        </div>
      </BottomSheetPanel>
    </BottomSheetOverlay>
  )
}

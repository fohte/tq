import { Clock, Layers, Palette, Repeat, X } from 'lucide-react'

import type { SchedulePanelProps } from '#components/schedule/create-schedule-modal'
import {
  contextLabels,
  contextValues,
  presetColors,
  recurrenceValues,
  WeekdayToggleRow,
} from '#components/schedule/create-schedule-modal'
import {
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { Button } from '#components/ui/button'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
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
import { cn } from '#lib/utils'

export function ScheduleModalMobilePanel({
  schedule,
  handleOpenChange,
  title,
  setTitle,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  recurrenceType,
  setRecurrenceType,
  daysOfWeek,
  toggleDay,
  context,
  setContext,
  color,
  setColor,
  onDelete,
  isPending,
  canSubmit,
  handleSubmit,
}: SchedulePanelProps) {
  return (
    <BottomSheetOverlay className="md:hidden">
      <BottomSheetPanel>
        {/* Header */}
        <BottomSheetHeader>
          <span className="text-base font-semibold text-foreground">
            {schedule ? 'Edit Schedule' : 'New Schedule'}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              handleOpenChange(false)
            }}
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
            placeholder="Schedule title"
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-lg font-medium shadow-none focus-visible:ring-0 focus-visible:border-0"
          />

          <div className="h-px bg-border" />

          {/* Chip row */}
          <div className="flex flex-wrap gap-2">
            <ExpandableFieldChip
              icon={<Clock className="size-3.5" />}
              label={startTime || 'Start'}
              active={!!startTime}
              expanded={() => (
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => {
                    setStartTime(e.target.value)
                  }}
                  autoFocus
                  aria-label="Start time"
                  className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                />
              )}
            />
            <ExpandableFieldChip
              icon={<Clock className="size-3.5" />}
              label={endTime || 'End'}
              active={!!endTime}
              expanded={() => (
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => {
                    setEndTime(e.target.value)
                  }}
                  autoFocus
                  aria-label="End time"
                  className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                />
              )}
            />
            <ExpandableFieldChip
              icon={<Repeat className="size-3.5" />}
              label={recurrenceType || 'Repeat'}
              active={!!recurrenceType}
              expanded={(close) => (
                <Select
                  value={recurrenceType}
                  onValueChange={(value) => {
                    selectValueHandler(
                      setRecurrenceType,
                      recurrenceValues,
                    )(value)
                    close()
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    autoFocus
                    className="h-auto border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0"
                  >
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
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
                    size="sm"
                    autoFocus
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
          </div>

          {recurrenceType === 'weekly' && (
            <WeekdayToggleRow daysOfWeek={daysOfWeek} toggleDay={toggleDay} />
          )}

          {startTime && endTime && startTime > endTime && (
            <p className="text-xs text-muted-foreground">
              Cross-midnight: {startTime} → {endTime} (next day)
            </p>
          )}

          {/* Color picker */}
          <div className="flex items-center gap-2">
            <Palette className="size-3.5 text-muted-foreground" />
            <div className="flex gap-1.5">
              {presetColors.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(color === c ? '' : c)
                  }}
                  className={cn(
                    'size-6 border-2 transition-all',
                    color === c
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-110',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Submit row */}
          <div className="flex items-center gap-2">
            {schedule && (
              <DeleteConfirmButton
                title="Delete schedule"
                description="Are you sure you want to delete this schedule? This action cannot be undone."
                onDelete={onDelete}
                disabled={isPending}
                aria-label="Delete schedule"
                iconClassName="size-5"
              />
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="h-12 flex-1 rounded-lg text-base font-semibold"
            >
              {schedule ? 'Save' : 'Create'}
            </Button>
          </div>
        </div>
      </BottomSheetPanel>
    </BottomSheetOverlay>
  )
}

import { Clock, Layers, Palette, Repeat, X } from 'lucide-react'

import type { SchedulePanelProps } from '#components/schedule/create-schedule-modal'
import {
  contextValues,
  presetColors,
  recurrenceValues,
  WeekdayToggleRow,
} from '#components/schedule/create-schedule-modal'
import { Button } from '#components/ui/button'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
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
import { cn } from '#lib/utils'

export function ScheduleModalDesktopPanel({
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
  dayOfMonth,
  setDayOfMonth,
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
    <div className="fixed inset-0 z-50 hidden items-center justify-center p-8 md:flex">
      <ModalPanel>
        {/* Header */}
        <DialogHeaderBar>
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
        </DialogHeaderBar>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-6">
          {/* Title */}
          <Input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
            }}
            placeholder="Schedule title"
            autoFocus
            className="h-auto border-0 bg-transparent p-0 text-xl font-medium shadow-none focus-visible:ring-0 focus-visible:border-0"
          />

          {/* Time fields */}
          <div className="flex items-end gap-4">
            <InlineFieldGroup
              label="Start"
              icon={<Clock className="size-3.5" />}
            >
              <Input
                type="time"
                value={startTime}
                onChange={(e) => {
                  setStartTime(e.target.value)
                }}
                aria-label="Start time"
                className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
              />
            </InlineFieldGroup>
            <InlineFieldGroup label="End" icon={<Clock className="size-3.5" />}>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => {
                  setEndTime(e.target.value)
                }}
                aria-label="End time"
                className="h-auto w-24 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
              />
            </InlineFieldGroup>
          </div>

          {startTime && endTime && startTime > endTime && (
            <p className="text-xs text-muted-foreground">
              Cross-midnight schedule: {startTime} → {endTime} (next day)
            </p>
          )}

          {/* Recurrence */}
          <div className="flex flex-col gap-2">
            <InlineFieldGroup
              label="Repeat"
              icon={<Repeat className="size-3.5" />}
            >
              <Select
                value={recurrenceType}
                onValueChange={selectValueHandler(
                  setRecurrenceType,
                  recurrenceValues,
                )}
              >
                <SelectTrigger
                  size="sm"
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
            </InlineFieldGroup>

            {recurrenceType === 'weekly' && (
              <WeekdayToggleRow daysOfWeek={daysOfWeek} toggleDay={toggleDay} />
            )}

            {recurrenceType === 'monthly' && (
              <InlineFieldGroup label="Day of month" icon={null}>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => {
                    setDayOfMonth(e.target.value)
                  }}
                  placeholder="1-31"
                  className="h-auto w-16 border-0 bg-transparent p-0 text-xs shadow-none focus-visible:ring-0 focus-visible:border-0"
                />
              </InlineFieldGroup>
            )}
          </div>

          {/* Context & Color */}
          <div className="flex flex-wrap items-end gap-4">
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

            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 font-mono text-2xs tracking-widest text-muted-foreground-faint">
                <Palette className="size-3.5" />
                Color
              </span>
              <div className="flex gap-1">
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
          </div>
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-3">
          <div>
            {schedule && (
              <DeleteConfirmButton
                title="Delete schedule"
                description="Are you sure you want to delete this schedule? This action cannot be undone."
                onDelete={onDelete}
                disabled={isPending}
                aria-label="Delete schedule"
              />
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => {
                handleOpenChange(false)
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending}
              className="h-9 rounded-lg px-4"
            >
              {schedule ? 'Save' : 'Create Schedule'}
            </Button>
          </div>
        </div>
      </ModalPanel>
    </div>
  )
}

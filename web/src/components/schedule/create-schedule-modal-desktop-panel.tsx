import { Button } from '@fohte/ui/button'
import { DialogHeaderBar } from '@fohte/ui/dialog'
import { Input } from '@fohte/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { CalendarDays, Clock, Layers, Palette, Repeat, X } from 'lucide-react'

import { ColorSwatchRadioGroup } from '#components/color-swatch-radio-group'
import type { SchedulePanelProps } from '#components/schedule/create-schedule-modal'
import {
  contextValues,
  presetColors,
  recurrenceValues,
  WeekdayToggleRow,
} from '#components/schedule/create-schedule-modal'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { DesktopModalFrame } from '#components/ui/desktop-modal-frame'
import { InlineFieldGroup } from '#components/ui/modal-field'
import { selectValueHandler } from '#lib/form-utils'

export function ScheduleModalDesktopPanel({
  schedule,
  handleOpenChange,
  title,
  setTitle,
  startDate,
  setStartDate,
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
    <DesktopModalFrame>
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
          variant="ghost"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
          }}
          placeholder="Schedule title"
          autoFocus
        />

        <InlineFieldGroup
          label="Start date"
          icon={<CalendarDays className="size-3.5" />}
        >
          <Input
            type="date"
            variant="ghost"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value)
            }}
            aria-label="Start date"
            className="w-36"
          />
        </InlineFieldGroup>

        {/* Time fields */}
        <div className="flex items-end gap-4">
          <InlineFieldGroup label="Start" icon={<Clock className="size-3.5" />}>
            <Input
              type="time"
              variant="ghost"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value)
              }}
              aria-label="Start time"
              className="w-24"
            />
          </InlineFieldGroup>
          <InlineFieldGroup label="End" icon={<Clock className="size-3.5" />}>
            <Input
              type="time"
              variant="ghost"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value)
              }}
              aria-label="End time"
              className="w-24"
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
              <SelectTrigger variant="ghost" size="sm">
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
                variant="ghost"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => {
                  setDayOfMonth(e.target.value)
                }}
                placeholder="1-31"
                className="w-16"
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
              <SelectTrigger variant="ghost" size="sm">
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
            <ColorSwatchRadioGroup
              options={presetColors}
              value={color}
              onValueChange={setColor}
              clearOnReselect
            />
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
    </DesktopModalFrame>
  )
}

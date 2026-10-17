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
import {
  contextValues,
  presetColors,
  recurrenceValues,
  WeekdayToggleRow,
} from '#components/schedule/schedule-modal-form-options'
import type { SchedulePanelProps } from '#components/schedule/schedule-modal-panel-props'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { DesktopModalFrame } from '#components/ui/desktop-modal-frame'
import { InlineFieldGroup } from '#components/ui/modal-field'
import { selectValueHandler } from '#lib/form-utils'

export function ScheduleModalDesktopPanel({
  schedule,
  handleOpenChange,
  scope,
  setScope,
  occurrenceDate,
  rangeAction,
  setRangeAction,
  canRestoreThisEvent,
  canEditTitle,
  canEditSeriesDetails,
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
  exceptions,
  isExceptionsLoading,
  onRestoreException,
  isRestorePending,
  remindBeforeMinutes,
  setRemindBeforeMinutes,
  reminderReady,
  previewText,
  isPreviewLoading,
  previewError,
  onDelete,
  isPending,
  canSubmit,
  handleSubmit,
}: SchedulePanelProps) {
  const isThisEventAction = scope === 'this' && rangeAction != null

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
        {schedule && (
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
              APPLY TO
            </span>
            <div className="grid grid-cols-3 gap-1 rounded-lg border border-border p-1">
              {(
                [
                  ['this', 'This event'],
                  ['following', 'This and following'],
                  ['all', 'All events'],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant={scope === value ? 'secondary' : 'ghost'}
                  size="sm"
                  aria-pressed={scope === value}
                  disabled={value === 'all' && !reminderReady}
                  onClick={() => {
                    setScope(value)
                  }}
                  className="h-8 px-2 text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Title */}
        {canEditTitle ? (
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
        ) : (
          <p className="border-b border-border py-1 text-base font-semibold text-foreground">
            {title}
          </p>
        )}

        {isThisEventAction ? (
          <p className="rounded-md bg-surface-strong px-3 py-2 text-xs text-muted-foreground">
            {rangeAction === 'skip'
              ? `Skip the occurrence on ${occurrenceDate}.`
              : `Restore the occurrence on ${occurrenceDate} to its scheduled date and time.`}
          </p>
        ) : (
          <>
            <InlineFieldGroup
              label={
                scope === 'this'
                  ? 'Date'
                  : scope === 'following'
                    ? 'From'
                    : 'Start date'
              }
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
            {scope === 'this' && (
              <p className="-mt-4 text-xs text-muted-foreground">
                Original date: {occurrenceDate}
              </p>
            )}

            <div className="flex items-end gap-4">
              <InlineFieldGroup
                label="Start"
                icon={<Clock className="size-3.5" />}
              >
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
              <InlineFieldGroup
                label="End"
                icon={<Clock className="size-3.5" />}
              >
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
          </>
        )}

        {/* Recurrence */}
        <div className="flex flex-col gap-2">
          <InlineFieldGroup
            label="Repeat"
            icon={<Repeat className="size-3.5" />}
          >
            {canEditSeriesDetails ? (
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
            ) : (
              <span className="text-sm text-muted-foreground">
                {recurrenceType || 'None'}
              </span>
            )}
          </InlineFieldGroup>

          {canEditSeriesDetails && recurrenceType === 'weekly' && (
            <WeekdayToggleRow daysOfWeek={daysOfWeek} toggleDay={toggleDay} />
          )}

          {canEditSeriesDetails && recurrenceType === 'monthly' && (
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
        {(scope === 'all' || !schedule) && (
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
        )}

        {scope === 'all' && schedule && (
          <div className="flex flex-col gap-2">
            <span className="font-mono text-2xs tracking-widest text-muted-foreground-faint">
              EXCEPTIONS
            </span>
            {isExceptionsLoading ? (
              <p className="text-xs text-muted-foreground">
                Loading exceptions…
              </p>
            ) : exceptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No exceptions</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {exceptions.map((exception) => (
                  <li
                    key={exception.occurrenceDate}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <span>
                      {exception.skipped
                        ? `${exception.occurrenceDate} · skipped`
                        : exception.movedToDate != null
                          ? `${exception.occurrenceDate} → ${exception.movedToDate}`
                          : `${exception.occurrenceDate} · time changed`}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isRestorePending}
                      onClick={() => {
                        onRestoreException(exception.occurrenceDate)
                      }}
                    >
                      Restore
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {(scope === 'all' || !schedule) && (
          <InlineFieldGroup
            label="Remind"
            icon={<Clock className="size-3.5" />}
          >
            <Input
              type="number"
              variant="ghost"
              min="0"
              max="1440"
              value={remindBeforeMinutes}
              disabled={!reminderReady}
              onChange={(e) => {
                setRemindBeforeMinutes(
                  e.target.value === '' ? '' : Number(e.target.value),
                )
              }}
              aria-label="Remind before start"
              placeholder="—"
              className="w-20"
            />
            <span className="text-xs text-muted-foreground">
              min before start
            </span>
          </InlineFieldGroup>
        )}

        {(previewText !== null || isPreviewLoading || previewError) && (
          <p
            aria-live="polite"
            className="rounded-md border-l-2 border-primary bg-surface-strong px-3 py-2 text-xs text-foreground"
          >
            {isPreviewLoading
              ? 'Updating preview…'
              : previewError
                ? 'Could not load the preview. Try again after editing.'
                : previewText}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-3">
        <div className="flex items-center gap-2">
          {schedule && scope === 'this' && (
            <>
              <Button
                type="button"
                variant={rangeAction === 'skip' ? 'destructive' : 'outline'}
                aria-pressed={rangeAction === 'skip'}
                onClick={() => {
                  setRangeAction(rangeAction === 'skip' ? null : 'skip')
                }}
              >
                Skip this event
              </Button>
              {canRestoreThisEvent && (
                <Button
                  type="button"
                  variant={rangeAction === 'restore' ? 'secondary' : 'outline'}
                  aria-pressed={rangeAction === 'restore'}
                  onClick={() => {
                    setRangeAction(rangeAction === 'restore' ? null : 'restore')
                  }}
                >
                  Restore
                </Button>
              )}
            </>
          )}
          {schedule && scope === 'following' && (
            <Button
              type="button"
              variant={rangeAction === 'endSeries' ? 'destructive' : 'outline'}
              aria-pressed={rangeAction === 'endSeries'}
              onClick={() => {
                setRangeAction(rangeAction === 'endSeries' ? null : 'endSeries')
              }}
            >
              End series here
            </Button>
          )}
          {schedule && scope === 'all' && (
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
            disabled={!canSubmit || isPending || isPreviewLoading}
            className="h-9 rounded-lg px-4"
          >
            {schedule ? 'Save' : 'Create Schedule'}
          </Button>
        </div>
      </div>
    </DesktopModalFrame>
  )
}

import { Button } from '@fohte/ui/button'
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
  contextLabels,
  contextValues,
  presetColors,
  recurrenceValues,
  WeekdayToggleRow,
} from '#components/schedule/schedule-modal-form-options'
import type { SchedulePanelProps } from '#components/schedule/schedule-modal-panel-props'
import {
  BottomSheetHeader,
  BottomSheetOverlay,
  BottomSheetPanel,
} from '#components/ui/bottom-sheet'
import { DeleteConfirmButton } from '#components/ui/delete-confirm-button'
import { ExpandableFieldChip } from '#components/ui/modal-field'
import { selectValueHandler } from '#lib/form-utils'

export function ScheduleModalMobilePanel({
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
                    className="h-auto min-h-8 px-0 text-2xs leading-3 whitespace-normal"
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

          <div className="h-px bg-border" />

          {/* Chip row */}
          <div className="flex flex-wrap gap-2">
            {isThisEventAction ? (
              <p className="w-full rounded-md bg-surface-strong px-3 py-2 text-xs text-muted-foreground">
                {rangeAction === 'skip'
                  ? `Skip the occurrence on ${occurrenceDate}.`
                  : `Restore the occurrence on ${occurrenceDate} to its scheduled date and time.`}
              </p>
            ) : (
              <>
                <ExpandableFieldChip
                  icon={<CalendarDays className="size-3.5" />}
                  label={`${scope === 'this' ? 'Date' : scope === 'following' ? 'From' : 'Start'}: ${startDate || '—'}`}
                  active={!!startDate}
                  expanded={() => (
                    <Input
                      type="date"
                      variant="ghost"
                      value={startDate}
                      onChange={(e) => {
                        setStartDate(e.target.value)
                      }}
                      autoFocus
                      aria-label="Start date"
                      className="w-36"
                    />
                  )}
                />
                {scope === 'this' && (
                  <span className="self-center text-2xs text-muted-foreground">
                    Original: {occurrenceDate}
                  </span>
                )}
                <ExpandableFieldChip
                  icon={<Clock className="size-3.5" />}
                  label={startTime || 'Start'}
                  active={!!startTime}
                  expanded={() => (
                    <Input
                      type="time"
                      variant="ghost"
                      value={startTime}
                      onChange={(e) => {
                        setStartTime(e.target.value)
                      }}
                      autoFocus
                      aria-label="Start time"
                      className="w-24"
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
                      variant="ghost"
                      value={endTime}
                      onChange={(e) => {
                        setEndTime(e.target.value)
                      }}
                      autoFocus
                      aria-label="End time"
                      className="w-24"
                    />
                  )}
                />
              </>
            )}
            {canEditSeriesDetails ? (
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
                    <SelectTrigger variant="ghost" size="sm" autoFocus>
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
            ) : (
              <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-3 text-sm text-muted-foreground">
                <Repeat className="size-3.5" />
                {recurrenceType || 'None'}
              </div>
            )}
            {(scope === 'all' || !schedule) && (
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
                    <SelectTrigger variant="ghost" size="sm" autoFocus>
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
            )}
          </div>

          {canEditSeriesDetails && recurrenceType === 'weekly' && (
            <WeekdayToggleRow daysOfWeek={daysOfWeek} toggleDay={toggleDay} />
          )}

          {canEditSeriesDetails && recurrenceType === 'monthly' && (
            <ExpandableFieldChip
              icon={<CalendarDays className="size-3.5" />}
              label={dayOfMonth ? `Day ${dayOfMonth}` : 'Day of month'}
              active={!!dayOfMonth}
              expanded={() => (
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
                  aria-label="Day of month"
                  className="w-16"
                />
              )}
            />
          )}

          {startTime && endTime && startTime > endTime && (
            <p className="text-xs text-muted-foreground">
              Cross-midnight: {startTime} → {endTime} (next day)
            </p>
          )}

          {(scope === 'all' || !schedule) && (
            <div className="flex items-center gap-2">
              <Palette className="size-3.5 text-muted-foreground" />
              <ColorSwatchRadioGroup
                options={presetColors}
                value={color}
                onValueChange={setColor}
                clearOnReselect
              />
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
            <ExpandableFieldChip
              icon={<Clock className="size-3.5" />}
              label={
                remindBeforeMinutes === ''
                  ? 'Remind: off'
                  : `Remind: ${String(remindBeforeMinutes)} min`
              }
              active={remindBeforeMinutes !== ''}
              expanded={() => (
                <div className="flex items-center gap-2">
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
                </div>
              )}
            />
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

          {/* Submit row */}
          <div className="flex items-center gap-2">
            {schedule && scope === 'all' && (
              <DeleteConfirmButton
                title="Delete schedule"
                description="Are you sure you want to delete this schedule? This action cannot be undone."
                onDelete={onDelete}
                disabled={isPending}
                aria-label="Delete schedule"
                iconClassName="size-5"
              />
            )}
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
                    variant={
                      rangeAction === 'restore' ? 'secondary' : 'outline'
                    }
                    aria-pressed={rangeAction === 'restore'}
                    onClick={() => {
                      setRangeAction(
                        rangeAction === 'restore' ? null : 'restore',
                      )
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
                variant={
                  rangeAction === 'endSeries' ? 'destructive' : 'outline'
                }
                aria-pressed={rangeAction === 'endSeries'}
                onClick={() => {
                  setRangeAction(
                    rangeAction === 'endSeries' ? null : 'endSeries',
                  )
                }}
              >
                End series here
              </Button>
            )}
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || isPending || isPreviewLoading}
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

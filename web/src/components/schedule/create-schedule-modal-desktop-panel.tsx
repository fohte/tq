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
import { ScheduleConstraintCheckResult } from '#components/schedule/schedule-constraint-check-result'
import { ScheduleConstraintsField } from '#components/schedule/schedule-constraints-field'
import { ScheduleEditScopeSelector } from '#components/schedule/schedule-edit-scope-selector'
import { ScheduleExceptionList } from '#components/schedule/schedule-exception-list'
import {
  contextValues,
  presetColors,
  recurrenceValues,
  WeekdayToggleRow,
} from '#components/schedule/schedule-modal-form-options'
import type { SchedulePanelProps } from '#components/schedule/schedule-modal-panel-props'
import { SchedulePreviewNotice } from '#components/schedule/schedule-preview-notice'
import { ScheduleRangeActionButtons } from '#components/schedule/schedule-range-action-buttons'
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
  isExceptionsError,
  onRestoreException,
  isRestorePending,
  remindBeforeMinutes,
  setRemindBeforeMinutes,
  reminderReady,
  constraints,
  constraintsLoading,
  constraintsError,
  constraintsSaveError,
  scheduleAfterConstraintsSaveError,
  constraintsDefaultOpen,
  onAddConstraints,
  onChangeConstraints,
  onRemoveConstraints,
  constraintCheckRange,
  constraintCheckDraftInvalid,
  constraintCheckViolations,
  isConstraintCheckLoading,
  isConstraintCheckError,
  constraintCheckIncomplete,
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
          <ScheduleEditScopeSelector
            scope={scope}
            setScope={setScope}
            reminderReady={reminderReady}
          />
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

        {(!schedule || scope === 'all') && (
          <ScheduleConstraintsField
            variant="desktop"
            value={constraints}
            isLoading={constraintsLoading}
            isError={constraintsError}
            saveError={constraintsSaveError}
            scheduleAfterConstraintsSaveError={
              scheduleAfterConstraintsSaveError
            }
            isPending={isPending}
            defaultOpen={constraintsDefaultOpen}
            onAdd={onAddConstraints}
            onChange={onChangeConstraints}
            onRemove={onRemoveConstraints}
          />
        )}

        {schedule &&
          constraints !== null &&
          !constraintsLoading &&
          !constraintsError && (
            <ScheduleConstraintCheckResult
              startDate={constraintCheckRange.startDate}
              endDate={constraintCheckRange.endDate}
              constraintViolations={constraintCheckViolations}
              isLoading={isConstraintCheckLoading}
              isError={isConstraintCheckError}
              isIncomplete={constraintCheckIncomplete}
              draftInvalid={constraintCheckDraftInvalid}
            />
          )}

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
          <ScheduleExceptionList
            exceptions={exceptions}
            isLoading={isExceptionsLoading}
            isError={isExceptionsError}
            onRestore={onRestoreException}
            isRestorePending={isRestorePending}
          />
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

        <SchedulePreviewNotice
          text={previewText}
          isLoading={isPreviewLoading}
          isError={previewError}
        />
      </div>

      {/* Footer */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border px-6 py-3">
        <div className="flex items-center gap-2">
          {schedule && scope === 'this' && (
            <ScheduleRangeActionButtons
              scope={scope}
              action={rangeAction}
              canRestore={canRestoreThisEvent}
              setAction={setRangeAction}
            />
          )}
          {schedule && scope === 'following' && (
            <ScheduleRangeActionButtons
              scope={scope}
              action={rangeAction}
              canRestore={canRestoreThisEvent}
              setAction={setRangeAction}
            />
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

import { Button } from '@fohte/ui/button'
import { Input } from '@fohte/ui/input'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'
import { useRef } from 'react'

import { WeekdayToggleRow } from '#components/schedule/create-schedule-modal'
import { selectValueHandler } from '#lib/form-utils'
import {
  buildRecurrenceRule,
  computeNextOccurrence,
  formatRecurrenceSummary,
  intervalUnitLabel,
  type RecurrenceRule,
} from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'

// The subset of RecurrenceType a template's REPEAT popup offers. Unlike a
// task's recurrence editor, a template's rule can never be cleared to "None"
// (see UpdateRecurringTemplateInput), so this omits the '' option.
export type TemplateRecurrenceType = 'daily' | 'weekly' | 'monthly'

const recurrenceTypeOptions: readonly TemplateRecurrenceType[] = [
  'daily',
  'weekly',
  'monthly',
]

export function TemplateRepeatFieldAppearance({
  recurrenceRule,
  isEditing,
  onOpenChange,
  type,
  onTypeChange,
  intervalInput,
  onIntervalInputChange,
  daysOfWeek,
  onToggleDay,
  dayOfMonth,
  onDayOfMonthChange,
  anchorDate,
  lastGeneratedDate,
  canSave,
  onSave,
}: {
  recurrenceRule: RecurrenceRule
  isEditing: boolean
  onOpenChange: (open: boolean) => void
  type: TemplateRecurrenceType
  onTypeChange: (type: TemplateRecurrenceType) => void
  intervalInput: string
  onIntervalInputChange: (value: string) => void
  daysOfWeek: number[]
  onToggleDay: (day: number) => void
  dayOfMonth: string
  onDayOfMonthChange: (value: string) => void
  anchorDate: string
  lastGeneratedDate: string | null
  canSave: boolean
  onSave: () => void
}) {
  const anchorRef = useRef<HTMLButtonElement>(null)

  const parsedInterval = Number.parseInt(intervalInput, 10)
  const intervalValue =
    Number.isInteger(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : null

  const draftRule = buildRecurrenceRule(
    type,
    intervalValue,
    daysOfWeek,
    dayOfMonth,
  )

  const nextOccurrence =
    draftRule != null
      ? computeNextOccurrence(lastGeneratedDate ?? anchorDate, draftRule)
      : null

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        REPEAT
      </span>
      <div className="font-mono text-xs text-foreground">
        <Button
          ref={anchorRef}
          type="button"
          variant="ghost"
          onClick={() => {
            onOpenChange(true)
          }}
          className="h-auto w-full min-w-0 shrink justify-start rounded-none border-0 bg-transparent p-0 text-left text-xs font-normal text-foreground shadow-none cursor-text transition-colors hover:bg-transparent hover:text-muted-foreground-strong active:translate-y-0 focus-visible:border-0 focus-visible:ring-0"
        >
          <span className="min-w-0 truncate">
            {formatRecurrenceSummary(recurrenceRule)}
          </span>
        </Button>
        <Popover
          open={isEditing}
          onOpenChange={onOpenChange}
          anchor={anchorRef}
        >
          <PopoverContent padding="md" className="w-72">
            <div className="flex flex-col gap-3">
              <Select
                value={type}
                onValueChange={selectValueHandler(
                  onTypeChange,
                  recurrenceTypeOptions,
                )}
              >
                <SelectTrigger
                  size="sm"
                  className="h-auto w-full justify-start gap-1 border-0 bg-transparent p-0 font-mono text-xs text-foreground shadow-none hover:text-muted-foreground-strong focus-visible:ring-0"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1.5 text-xs text-foreground">
                Every
                <Input
                  type="number"
                  min="1"
                  value={intervalInput}
                  onChange={(e) => {
                    onIntervalInputChange(e.target.value)
                  }}
                  className="h-auto w-12 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
                />
                {intervalUnitLabel(type, intervalValue ?? 1)}
              </div>

              {type === 'weekly' && (
                <WeekdayToggleRow
                  daysOfWeek={daysOfWeek}
                  toggleDay={onToggleDay}
                />
              )}

              {type === 'monthly' && (
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={dayOfMonth}
                  onChange={(e) => {
                    onDayOfMonthChange(e.target.value)
                  }}
                  placeholder="Day of month (1-31)"
                  className="h-auto w-full border-0 border-b border-border bg-transparent p-0 pb-1 text-xs shadow-none focus-visible:ring-0"
                />
              )}

              {nextOccurrence != null && (
                <p className="text-2xs text-muted-foreground">
                  Next: {formatShortDate(nextOccurrence)}
                </p>
              )}

              <Button
                size="sm"
                onClick={onSave}
                disabled={!canSave}
                className="self-end"
              >
                Save
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

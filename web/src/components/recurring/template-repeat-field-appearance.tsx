import { Button } from '@fohte/ui/button'
import { Popover, PopoverContent } from '@fohte/ui/popover'
import { useRef } from 'react'

import {
  RecurrenceRuleFields,
  type TemplateRecurrenceType,
} from '#components/recurring/recurrence-rule-fields'
import { FieldTriggerWithChevron } from '#components/ui/field-trigger-with-chevron'
import {
  buildRecurrenceRule,
  computeNextOccurrence,
  formatRecurrenceSummary,
  type RecurrenceRule,
} from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'

export type { TemplateRecurrenceType }

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
        <FieldTriggerWithChevron
          ref={anchorRef}
          onClick={() => {
            onOpenChange(true)
          }}
        >
          {formatRecurrenceSummary(recurrenceRule)}
        </FieldTriggerWithChevron>
        <Popover
          open={isEditing}
          onOpenChange={onOpenChange}
          anchor={anchorRef}
        >
          <PopoverContent padding="md" className="w-72">
            <div className="flex flex-col gap-3">
              <RecurrenceRuleFields
                type={type}
                onTypeChange={onTypeChange}
                intervalInput={intervalInput}
                onIntervalInputChange={onIntervalInputChange}
                daysOfWeek={daysOfWeek}
                onToggleDay={onToggleDay}
                dayOfMonth={dayOfMonth}
                onDayOfMonthChange={onDayOfMonthChange}
              />

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

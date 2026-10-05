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
import { Link } from '@tanstack/react-router'
import { useRef } from 'react'

import { WeekdayToggleRow } from '#components/schedule/create-schedule-modal'
import {
  SidebarField,
  sidebarFieldValueButtonClassName,
} from '#components/task/sidebar-field'
import { formatLocalDate } from '#lib/date-range'
import { selectValueHandler } from '#lib/form-utils'
import {
  buildRecurrenceRule,
  computeNextOccurrence,
  formatRecurrenceSummary,
  intervalUnitLabel,
  type RecurrenceRule,
  type RecurrenceTypeOption,
} from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'

const recurrenceTypeOptions: readonly RecurrenceTypeOption[] = [
  '',
  'daily',
  'weekly',
  'monthly',
]

export function SidebarRecurrenceFieldAppearance({
  templateId,
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
  shorthandInput,
  onShorthandInputChange,
  dueDate,
  canSave,
  onSave,
}: {
  templateId: string | null
  recurrenceRule: RecurrenceRule | null
  isEditing: boolean
  onOpenChange: (open: boolean) => void
  type: RecurrenceTypeOption
  onTypeChange: (type: RecurrenceTypeOption) => void
  intervalInput: string
  onIntervalInputChange: (value: string) => void
  daysOfWeek: number[]
  onToggleDay: (day: number) => void
  dayOfMonth: string
  onDayOfMonthChange: (value: string) => void
  shorthandInput: string
  onShorthandInputChange: (value: string) => void
  dueDate: string | null
  canSave: boolean
  onSave: () => void
}) {
  const anchorRef = useRef<HTMLButtonElement>(null)

  // A template-generated task can't PATCH recurrenceRule (the API rejects
  // it with 400), so this renders a read-only summary instead of the
  // editable popup below.
  if (templateId != null) {
    return (
      <SidebarField label="RECURRENCE">
        <div className="flex flex-col gap-0.5">
          <span>
            {recurrenceRule != null
              ? formatRecurrenceSummary(recurrenceRule)
              : '—'}
          </span>
          <Link
            to="/recurring/$templateId"
            params={{ templateId }}
            className="font-mono text-2xs text-muted-foreground-faint transition-colors hover:text-muted-foreground-strong"
          >
            Edit template →
          </Link>
        </div>
      </SidebarField>
    )
  }

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
      ? computeNextOccurrence(dueDate ?? formatLocalDate(new Date()), draftRule)
      : null

  return (
    <SidebarField label="RECURRENCE">
      <Button
        ref={anchorRef}
        type="button"
        variant="ghost"
        onClick={() => {
          onOpenChange(true)
        }}
        className={`${sidebarFieldValueButtonClassName} min-w-0`}
      >
        <span className="min-w-0 truncate">
          {recurrenceRule != null
            ? formatRecurrenceSummary(recurrenceRule)
            : '—'}
        </span>
      </Button>
      <Popover open={isEditing} onOpenChange={onOpenChange} anchor={anchorRef}>
        <PopoverContent padding="md" className="w-72">
          <div className="flex flex-col gap-3">
            <Input
              type="text"
              value={shorthandInput}
              onChange={(e) => {
                onShorthandInputChange(e.target.value)
              }}
              placeholder="*weekly, *sun, *毎週 ..."
              className="h-auto w-full border-0 border-b border-border bg-transparent p-0 pb-1 text-xs shadow-none focus-visible:ring-0"
            />

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
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>

            {type !== '' && (
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
            )}

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
    </SidebarField>
  )
}

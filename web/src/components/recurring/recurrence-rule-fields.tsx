import { Input } from '@fohte/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@fohte/ui/select'

import { WeekdayToggleRow } from '#components/schedule/create-schedule-modal'
import { selectValueHandler } from '#lib/form-utils'
import { intervalUnitLabel } from '#lib/recurrence'

// Template rules cannot be cleared through the recurring-template API.
export type TemplateRecurrenceType = 'daily' | 'weekly' | 'monthly'

const recurrenceTypeOptions: readonly TemplateRecurrenceType[] = [
  'daily',
  'weekly',
  'monthly',
]

export function RecurrenceRuleFields({
  type,
  onTypeChange,
  intervalInput,
  onIntervalInputChange,
  daysOfWeek,
  onToggleDay,
  dayOfMonth,
  onDayOfMonthChange,
}: {
  type: TemplateRecurrenceType
  onTypeChange: (type: TemplateRecurrenceType) => void
  intervalInput: string
  onIntervalInputChange: (value: string) => void
  daysOfWeek: number[]
  onToggleDay: (day: number) => void
  dayOfMonth: string
  onDayOfMonthChange: (value: string) => void
}) {
  const parsedInterval = Number.parseInt(intervalInput, 10)
  const intervalValue =
    Number.isInteger(parsedInterval) && parsedInterval > 0
      ? parsedInterval
      : null

  return (
    <>
      <Select
        value={type}
        onValueChange={selectValueHandler(onTypeChange, recurrenceTypeOptions)}
      >
        <SelectTrigger
          variant="ghost"
          size="sm"
          className="w-full justify-start"
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
          variant="ghost"
          min="1"
          value={intervalInput}
          onChange={(e) => {
            onIntervalInputChange(e.target.value)
          }}
          className="w-12"
        />
        {intervalUnitLabel(type, intervalValue ?? 1)}
      </div>

      {type === 'weekly' && (
        <WeekdayToggleRow daysOfWeek={daysOfWeek} toggleDay={onToggleDay} />
      )}

      {type === 'monthly' && (
        <Input
          type="number"
          variant="ghost"
          min="1"
          max="31"
          value={dayOfMonth}
          onChange={(e) => {
            onDayOfMonthChange(e.target.value)
          }}
          placeholder="Day of month (1-31)"
          className="w-full"
        />
      )}
    </>
  )
}

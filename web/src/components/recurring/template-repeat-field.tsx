import { useRef, useState } from 'react'

import {
  toggleWeekday,
  WeekdayToggleRow,
} from '#components/schedule/create-schedule-modal'
import { fieldValueClassName } from '#components/task/sidebar-field'
import { AnchoredPopup } from '#components/ui/anchored-popup'
import { Button } from '#components/ui/button'
import { Input } from '#components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#components/ui/select'
import { useUpdateRecurringTemplate } from '#hooks/use-recurring-templates'
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
type TemplateRecurrenceType = 'daily' | 'weekly' | 'monthly'

const recurrenceTypeOptions: readonly TemplateRecurrenceType[] = [
  'daily',
  'weekly',
  'monthly',
]

export function TemplateRepeatField({
  templateId,
  recurrenceRule,
  lastGeneratedDate,
  anchorDate,
}: {
  templateId: string
  recurrenceRule: RecurrenceRule
  lastGeneratedDate: string | null
  anchorDate: string
}) {
  const [isEditing, setIsEditing] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const updateTemplate = useUpdateRecurringTemplate()

  // A 'custom' rule (only reachable via the API/MCP, never created by this
  // UI) has no matching Select option, so editing one starts the draft from
  // 'weekly' rather than showing a stale/mismatched selection.
  const initialType: TemplateRecurrenceType =
    recurrenceRule.type === 'daily' ||
    recurrenceRule.type === 'weekly' ||
    recurrenceRule.type === 'monthly'
      ? recurrenceRule.type
      : 'weekly'

  const [type, setType] = useState<TemplateRecurrenceType>(initialType)
  const [intervalInput, setIntervalInput] = useState(
    String(recurrenceRule.interval),
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    recurrenceRule.daysOfWeek ?? [],
  )
  const [dayOfMonth, setDayOfMonth] = useState(
    recurrenceRule.dayOfMonth != null ? String(recurrenceRule.dayOfMonth) : '',
  )

  const resetDraft = () => {
    setType(initialType)
    setIntervalInput(String(recurrenceRule.interval))
    setDaysOfWeek(recurrenceRule.daysOfWeek ?? [])
    setDayOfMonth(
      recurrenceRule.dayOfMonth != null
        ? String(recurrenceRule.dayOfMonth)
        : '',
    )
  }

  const openEditing = () => {
    resetDraft()
    setIsEditing(true)
  }

  const stopEditing = () => {
    setIsEditing(false)
  }

  const toggleDay = (day: number) => {
    setDaysOfWeek((prev) => toggleWeekday(prev, day))
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

  const originalRule = buildRecurrenceRule(
    initialType,
    recurrenceRule.interval,
    recurrenceRule.daysOfWeek ?? [],
    recurrenceRule.dayOfMonth != null ? String(recurrenceRule.dayOfMonth) : '',
  )
  const hasChanges = JSON.stringify(draftRule) !== JSON.stringify(originalRule)
  // draftRule is only ever null here if intervalValue is invalid — a rule
  // always exists once type/interval are set, so this is a type-safety
  // formality rather than a real "cleared" state (see TemplateRecurrenceType
  // above).
  const canSave = hasChanges && draftRule != null

  const nextOccurrence =
    draftRule != null
      ? computeNextOccurrence(lastGeneratedDate ?? anchorDate, draftRule)
      : null

  const handleSave = () => {
    if (draftRule == null) return
    updateTemplate.mutate({
      id: templateId,
      input: { recurrenceRule: draftRule },
    })
    stopEditing()
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-2xs text-muted-foreground-faint">
        REPEAT
      </span>
      <div className="font-mono text-xs text-foreground">
        <button
          ref={anchorRef}
          type="button"
          onClick={openEditing}
          className="w-full cursor-text truncate text-left transition-colors hover:text-muted-foreground-strong"
        >
          {formatRecurrenceSummary(recurrenceRule)}
        </button>
        <AnchoredPopup
          open={isEditing}
          onOpenChange={(open) => {
            if (!open) stopEditing()
          }}
          anchor={anchorRef}
          className="w-72 p-3"
        >
          <div className="flex flex-col gap-3">
            <Select
              value={type}
              onValueChange={selectValueHandler(setType, recurrenceTypeOptions)}
            >
              <SelectTrigger size="sm" className={fieldValueClassName}>
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
                  setIntervalInput(e.target.value)
                }}
                className="h-auto w-12 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
              />
              {intervalUnitLabel(type, intervalValue ?? 1)}
            </div>

            {type === 'weekly' && (
              <WeekdayToggleRow daysOfWeek={daysOfWeek} toggleDay={toggleDay} />
            )}

            {type === 'monthly' && (
              <Input
                type="number"
                min="1"
                max="31"
                value={dayOfMonth}
                onChange={(e) => {
                  setDayOfMonth(e.target.value)
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
              onClick={handleSave}
              disabled={!canSave}
              className="self-end"
            >
              Save
            </Button>
          </div>
        </AnchoredPopup>
      </div>
    </div>
  )
}

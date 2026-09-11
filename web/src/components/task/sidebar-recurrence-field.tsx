import { useRef, useState } from 'react'

import {
  toggleWeekday,
  WeekdayToggleRow,
} from '#components/schedule/create-schedule-modal'
import {
  fieldValueClassName,
  SidebarField,
} from '#components/task/sidebar-field'
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
import { useUpdateTaskRecurrenceRule } from '#hooks/use-tasks'
import { formatLocalDate } from '#lib/date-range'
import { selectValueHandler } from '#lib/form-utils'
import {
  computeNextOccurrence,
  formatRecurrenceSummary,
  type RecurrenceRule,
} from '#lib/recurrence'
import { formatShortDate } from '#lib/task-due-date'
import { parseRecurrenceShorthand } from '#lib/task-shorthand'

type RecurrenceTypeOption = '' | 'daily' | 'weekly' | 'monthly'
const recurrenceTypeOptions: readonly RecurrenceTypeOption[] = [
  '',
  'daily',
  'weekly',
  'monthly',
]

function buildRule(
  type: RecurrenceTypeOption,
  interval: number | null,
  daysOfWeek: number[],
  dayOfMonth: string,
) {
  if (type === '' || interval == null) return null
  return {
    type,
    interval,
    ...(type === 'weekly' && daysOfWeek.length > 0
      ? { daysOfWeek: [...daysOfWeek].sort((a, b) => a - b) }
      : {}),
    ...(type === 'monthly' && dayOfMonth
      ? { dayOfMonth: Number.parseInt(dayOfMonth, 10) }
      : {}),
  }
}

function intervalUnitLabel(
  type: 'daily' | 'weekly' | 'monthly',
  interval: number,
): string {
  const plural = interval !== 1
  switch (type) {
    case 'daily':
      return plural ? 'days' : 'day'
    case 'weekly':
      return plural ? 'weeks' : 'week'
    case 'monthly':
      return plural ? 'months' : 'month'
  }
}

export function SidebarRecurrenceField({
  taskId,
  dueDate,
  recurrenceRule,
  templateId,
}: {
  taskId: string
  dueDate: string | null
  recurrenceRule: RecurrenceRule | null
  templateId: string | null
}) {
  const [isEditing, setIsEditing] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const updateRecurrenceRule = useUpdateTaskRecurrenceRule()

  // A 'custom' rule (only reachable via the API/MCP directly, never created
  // by this UI) has no matching Select option, so editing one starts the
  // draft from 'None' rather than showing a stale/mismatched selection.
  const initialType: RecurrenceTypeOption =
    recurrenceRule?.type === 'daily' ||
    recurrenceRule?.type === 'weekly' ||
    recurrenceRule?.type === 'monthly'
      ? recurrenceRule.type
      : ''

  const [type, setType] = useState<RecurrenceTypeOption>(initialType)
  const [intervalInput, setIntervalInput] = useState(
    String(recurrenceRule?.interval ?? 1),
  )
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    recurrenceRule?.daysOfWeek ?? [],
  )
  const [dayOfMonth, setDayOfMonth] = useState(
    recurrenceRule?.dayOfMonth != null ? String(recurrenceRule.dayOfMonth) : '',
  )
  // Scratch input for the `*` shorthand grammar. One-directional: typing
  // here updates the controls below, but the controls never write back —
  // the controls are the only value that gets saved.
  const [shorthandInput, setShorthandInput] = useState('')

  const resetDraft = () => {
    setType(initialType)
    setIntervalInput(String(recurrenceRule?.interval ?? 1))
    setDaysOfWeek(recurrenceRule?.daysOfWeek ?? [])
    setDayOfMonth(
      recurrenceRule?.dayOfMonth != null
        ? String(recurrenceRule.dayOfMonth)
        : '',
    )
    setShorthandInput('')
  }

  const handleShorthandInputChange = (value: string) => {
    setShorthandInput(value)
    const rule = parseRecurrenceShorthand(value)
    if (rule == null) return
    setType(rule.type)
    setIntervalInput(String(rule.interval))
    setDaysOfWeek(rule.daysOfWeek ?? [])
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

  const draftRule = buildRule(type, intervalValue, daysOfWeek, dayOfMonth)

  // A rule of type 'custom' (only reachable via the API/MCP) has no
  // matching Select option, so initialType is '' even though a rule
  // exists — comparing against the *original* values (not just "is a rule
  // selected") keeps Save disabled until something actually changes,
  // rather than defaulting to an enabled Save that would silently clear
  // that custom rule on the first click.
  const originalRule = buildRule(
    initialType,
    recurrenceRule?.interval ?? 1,
    recurrenceRule?.daysOfWeek ?? [],
    recurrenceRule?.dayOfMonth != null ? String(recurrenceRule.dayOfMonth) : '',
  )
  const hasChanges = JSON.stringify(draftRule) !== JSON.stringify(originalRule)
  const canSave = hasChanges && (type === '' || intervalValue != null)

  const nextOccurrence =
    draftRule != null
      ? computeNextOccurrence(dueDate ?? formatLocalDate(new Date()), draftRule)
      : null

  const handleSave = () => {
    if (!canSave) return
    updateRecurrenceRule.mutate({ id: taskId, recurrenceRule: draftRule })
    stopEditing()
  }

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
          <span className="font-mono text-2xs text-muted-foreground-faint">
            Generated from a template
          </span>
        </div>
      </SidebarField>
    )
  }

  return (
    <SidebarField label="RECURRENCE">
      <button
        ref={anchorRef}
        type="button"
        onClick={openEditing}
        className="w-full cursor-text truncate text-left transition-colors hover:text-muted-foreground-strong"
      >
        {recurrenceRule != null ? formatRecurrenceSummary(recurrenceRule) : '—'}
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
          <Input
            type="text"
            value={shorthandInput}
            onChange={(e) => {
              handleShorthandInputChange(e.target.value)
            }}
            placeholder="*weekly, *sun, *毎週 ..."
            className="h-auto w-full border-0 border-b border-border bg-transparent p-0 pb-1 text-xs shadow-none focus-visible:ring-0"
          />

          <Select
            value={type}
            onValueChange={selectValueHandler(setType, recurrenceTypeOptions)}
          >
            <SelectTrigger size="sm" className={fieldValueClassName}>
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
                  setIntervalInput(e.target.value)
                }}
                className="h-auto w-12 border-0 bg-transparent p-0 text-center shadow-none focus-visible:ring-0"
              />
              {intervalUnitLabel(type, intervalValue ?? 1)}
            </div>
          )}

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
    </SidebarField>
  )
}

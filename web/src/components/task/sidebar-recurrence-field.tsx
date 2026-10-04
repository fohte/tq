import { useState } from 'react'

import { toggleWeekday } from '#components/schedule/create-schedule-modal'
import { SidebarRecurrenceFieldAppearance } from '#components/task/sidebar-recurrence-field-appearance'
import { useUpdateTaskRecurrenceRule } from '#hooks/use-tasks'
import {
  buildRecurrenceRule,
  type RecurrenceRule,
  type RecurrenceTypeOption,
} from '#lib/recurrence'
import { parseRecurrenceShorthand } from '#lib/task-shorthand'

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

  const handleOpenChange = (open: boolean) => {
    if (open) resetDraft()
    setIsEditing(open)
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

  // A rule of type 'custom' (only reachable via the API/MCP) has no
  // matching Select option, so initialType is '' even though a rule
  // exists — comparing against the *original* values (not just "is a rule
  // selected") keeps Save disabled until something actually changes,
  // rather than defaulting to an enabled Save that would silently clear
  // that custom rule on the first click.
  const originalRule = buildRecurrenceRule(
    initialType,
    recurrenceRule?.interval ?? 1,
    recurrenceRule?.daysOfWeek ?? [],
    recurrenceRule?.dayOfMonth != null ? String(recurrenceRule.dayOfMonth) : '',
  )
  const hasChanges = JSON.stringify(draftRule) !== JSON.stringify(originalRule)
  const canSave = hasChanges && (type === '' || intervalValue != null)

  const handleSave = () => {
    if (!canSave) return
    updateRecurrenceRule.mutate({ id: taskId, recurrenceRule: draftRule })
    setIsEditing(false)
  }

  return (
    <SidebarRecurrenceFieldAppearance
      templateId={templateId}
      recurrenceRule={recurrenceRule}
      isEditing={isEditing}
      onOpenChange={handleOpenChange}
      type={type}
      onTypeChange={setType}
      intervalInput={intervalInput}
      onIntervalInputChange={setIntervalInput}
      daysOfWeek={daysOfWeek}
      onToggleDay={toggleDay}
      dayOfMonth={dayOfMonth}
      onDayOfMonthChange={setDayOfMonth}
      shorthandInput={shorthandInput}
      onShorthandInputChange={handleShorthandInputChange}
      dueDate={dueDate}
      canSave={canSave}
      onSave={handleSave}
    />
  )
}

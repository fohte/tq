import { useState } from 'react'

import {
  type TemplateRecurrenceType,
  TemplateRepeatFieldAppearance,
} from '#components/recurring/template-repeat-field-appearance'
import { toggleWeekday } from '#components/schedule/create-schedule-modal'
import { useUpdateRecurringTemplate } from '#hooks/use-recurring-templates'
import { buildRecurrenceRule, type RecurrenceRule } from '#lib/recurrence'

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

  const handleOpenChange = (open: boolean) => {
    if (open) {
      openEditing()
    } else {
      stopEditing()
    }
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
  const canSave = hasChanges && draftRule != null

  const handleSave = () => {
    if (draftRule == null) return
    updateTemplate.mutate({
      id: templateId,
      input: { recurrenceRule: draftRule },
    })
    stopEditing()
  }

  return (
    <TemplateRepeatFieldAppearance
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
      anchorDate={anchorDate}
      lastGeneratedDate={lastGeneratedDate}
      canSave={canSave}
      onSave={handleSave}
    />
  )
}

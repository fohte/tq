import { useState } from 'react'

import {
  type TemplateRecurrenceType,
  TemplateRepeatFieldAppearance,
} from '#components/recurring/template-repeat-field-appearance'
import { useRecurrenceRuleDraft } from '#components/recurring/use-recurrence-rule-draft'
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

  const draft = useRecurrenceRuleDraft({
    type: initialType,
    intervalInput: String(recurrenceRule.interval),
    ...(recurrenceRule.daysOfWeek == null
      ? {}
      : { daysOfWeek: recurrenceRule.daysOfWeek }),
    dayOfMonth:
      recurrenceRule.dayOfMonth != null
        ? String(recurrenceRule.dayOfMonth)
        : '',
  })

  const openEditing = () => {
    draft.reset()
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

  const draftRule = draft.recurrenceRule

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
      type={draft.type}
      onTypeChange={draft.setType}
      intervalInput={draft.intervalInput}
      onIntervalInputChange={draft.setIntervalInput}
      daysOfWeek={draft.daysOfWeek}
      onToggleDay={draft.toggleDay}
      dayOfMonth={draft.dayOfMonth}
      onDayOfMonthChange={draft.setDayOfMonth}
      anchorDate={anchorDate}
      lastGeneratedDate={lastGeneratedDate}
      canSave={canSave}
      onSave={handleSave}
    />
  )
}

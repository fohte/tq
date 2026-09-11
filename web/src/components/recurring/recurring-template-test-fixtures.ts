import type { RecurringTemplate } from '#hooks/use-recurring-templates'

export function makeRecurringTemplate(
  overrides: Partial<RecurringTemplate> = {},
): RecurringTemplate {
  return {
    id: 'recurring-template-1',
    title: 'Write blog post',
    description: null,
    estimatedMinutes: null,
    projectId: null,
    parentId: null,
    context: 'personal',
    labels: [],
    recurrenceRuleId: 'recurrence-rule-1',
    recurrenceRule: {
      id: 'recurrence-rule-1',
      type: 'weekly',
      interval: 1,
      daysOfWeek: [0],
      dayOfMonth: null,
    },
    startOffsetDays: null,
    anchorDate: '2026-03-20',
    lastGeneratedDate: null,
    enabled: true,
    createdAt: '2026-03-20T00:00:00.000Z',
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

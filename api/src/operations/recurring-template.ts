import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import { defineOperation, requestJson } from '#operations/types'
import { createRecurringTaskOccurrenceSchema } from '#schemas/recurring-task-template'

const createOccurrenceInputSchema = createRecurringTaskOccurrenceSchema.extend({
  templateId: pathSegmentSchema('Recurring task template ID'),
})

export const recurringTemplateOperations = [
  defineOperation(createOccurrenceInputSchema, {
    path: ['recurring-template', 'occurrence', 'create'],
    description:
      'Create one task occurrence from a recurring task template for any date.',
    positionalArgs: ['templateId', 'occurrenceDate'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/recurring-task-templates/:id/occurrences'],
    cli: {
      group: { description: 'Manage recurring task templates', order: 18 },
      output: { kind: 'json' },
    },
    run: (client, { templateId, occurrenceDate }) =>
      requestJson(
        client.api['recurring-task-templates'][':id'].occurrences.$post({
          param: { id: encodePathSegment(templateId) },
          json: { occurrenceDate },
        }),
      ),
  }),
] as const

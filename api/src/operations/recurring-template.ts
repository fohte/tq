import { err, ok } from 'neverthrow'
import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  recurrenceCliOptions,
  recurrenceRuleFromCli,
} from '#operations/recurrence-cli'
import { defineOperation, requestJson } from '#operations/types'
import { updateRecurringTaskTemplateSchema } from '#schemas/recurring-task-template'

const recurringTemplateIdSchema = pathSegmentSchema(
  'Recurring task template ID',
)
const getRecurringTemplateInputSchema = z.object({
  id: recurringTemplateIdSchema,
})
const updateRecurringTemplateInputSchema =
  updateRecurringTaskTemplateSchema.extend({ id: recurringTemplateIdSchema })
const listRecurringTemplateInputSchema = z.object({
  context: z.enum(['work', 'personal']).optional(),
  enabled: z.enum(['true', 'false']).optional(),
})

function mapUpdateCliInput(
  input: Record<string, unknown>,
  options: Record<string, unknown>,
) {
  return recurrenceRuleFromCli(options).andThen((recurrenceRule) => {
    if (options['enable'] === true && options['disable'] === true) {
      return err(new Error('Use either --enable or --disable, not both.'))
    }

    const mappedInput = { ...input }
    if (options['enable'] === true) mappedInput['enabled'] = true
    if (options['disable'] === true) mappedInput['enabled'] = false
    if (recurrenceRule !== undefined) {
      mappedInput['recurrenceRule'] = recurrenceRule
    }

    if (Object.keys(mappedInput).every((key) => key === 'id')) {
      return err(new Error('Pass at least one flag to update'))
    }
    return ok(mappedInput)
  })
}

export const recurringTemplateOperations = [
  defineOperation(listRecurringTemplateInputSchema, {
    path: ['recurring-template', 'list'],
    description:
      'List recurring task templates, optionally filtered by context and enabled state.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/recurring-task-templates'],
    cli: {
      group: { description: 'Manage recurring task templates', order: 18 },
      output: { kind: 'json' },
    },
    run: (client, { context, enabled }) =>
      requestJson(
        client.api['recurring-task-templates'].$get({
          query: {
            ...(context === undefined ? {} : { context }),
            ...(enabled === undefined ? {} : { enabled }),
          },
        }),
      ),
  }),
  defineOperation(getRecurringTemplateInputSchema, {
    path: ['recurring-template', 'get'],
    description: 'Get a recurring task template by its UUID.',
    positionalArgs: ['id'],
    kind: 'read',
    routes: ['GET /api/recurring-task-templates/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestJson(
        client.api['recurring-task-templates'][':id'].$get({
          param: { id: encodePathSegment(id) },
        }),
      ),
  }),
  defineOperation(updateRecurringTemplateInputSchema, {
    path: ['recurring-template', 'update'],
    description: 'Update a recurring task template.',
    positionalArgs: ['id'],
    kind: 'write',
    routes: ['PATCH /api/recurring-task-templates/:id'],
    cli: {
      excludeFields: ['enabled', 'recurrenceRule'],
      commaSeparatedOptions: ['labels'],
      optionDescriptions: {
        labels:
          'Comma-separated label names to set (replaces the full set; unknown names are created)',
      },
      optionMetavars: { labels: 'names' },
      customOptions: [
        { flags: '--enable', description: 'Enable the template' },
        { flags: '--disable', description: 'Disable the template' },
        ...recurrenceCliOptions(),
      ],
      mapInput: mapUpdateCliInput,
      output: { kind: 'json' },
    },
    run: (client, { id, ...json }) =>
      requestJson(
        client.api['recurring-task-templates'][':id'].$patch({
          param: { id: encodePathSegment(id) },
          json,
        }),
      ),
  }),
] as const

import { err, ok } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createTaskWaitFieldsSchema,
  updateTaskWaitFieldsSchema,
} from '#schemas/task-wait'
import { timezoneOffsetMinutesSchema } from '#schemas/timezone'

const waitIdSchema = z.uuid()
const createWaitInputFieldsSchema = createTaskWaitFieldsSchema.extend({
  taskId: taskIdOrNumber,
  tzOffset: timezoneOffsetMinutesSchema.optional(),
})
const createWaitMcpInputSchema = createWaitInputFieldsSchema
  .extend({ tzOffset: timezoneOffsetMinutesSchema })
  .refine(
    (input) => input.body !== undefined || input.githubUrl !== undefined,
    'Pass a body or GitHub URL',
  )
const waitReferenceSchema = z.object({
  taskId: taskIdOrNumber,
  waitId: waitIdSchema,
})
const updateWaitInputSchema = updateTaskWaitFieldsSchema.extend({
  taskId: taskIdOrNumber,
  waitId: waitIdSchema,
})

export const waitOperations = [
  defineOperation(createWaitInputFieldsSchema, {
    path: ['wait', 'add'],
    description: 'Add a wait for a response to a task.',
    positionalArgs: ['taskId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/waits'],
    mcpInputSchema: createWaitMcpInputSchema,
    cli: {
      group: { description: 'Manage waits', order: 3 },
      excludeFields: ['tzOffset'],
      mapInput: (input) =>
        input['body'] === undefined && input['githubUrl'] === undefined
          ? err(new Error('Pass a body or GitHub URL'))
          : ok(input),
      optionDescriptions: {
        body: 'Markdown describing what response the task is waiting for',
        githubUrl: 'GitHub issue or pull request blocker URL',
        followUpDate: 'Date to follow up if there is no response (YYYY-MM-DD)',
      },
      optionMetavars: {
        body: 'markdown',
        githubUrl: 'url',
        followUpDate: 'date',
      },
      output: { kind: 'json' },
    },
    run: (client, { taskId, body, githubUrl, followUpDate, tzOffset }) =>
      requestJson(
        client.api.tasks[':taskId'].waits.$post({
          param: { taskId: encodePathSegment(String(taskId)) },
          json: {
            body,
            githubUrl,
            followUpDate,
            tzOffset: tzOffset ?? new Date().getTimezoneOffset(),
          },
        }),
      ),
  }),
  defineOperation(updateWaitInputSchema, {
    path: ['wait', 'update'],
    description: 'Update the body or follow-up date of a wait.',
    positionalArgs: ['taskId', 'waitId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:taskId/waits/:waitId'],
    cli: {
      mapInput: (input) =>
        input['body'] === undefined && input['followUpDate'] === undefined
          ? err(new Error('Pass at least one flag to update'))
          : ok(input),
      optionDescriptions: {
        body: 'Markdown describing what response the task is waiting for',
        followUpDate: 'Date to follow up if there is no response (YYYY-MM-DD)',
      },
      optionMetavars: { body: 'markdown', followUpDate: 'date' },
      output: { kind: 'json' },
    },
    run: (client, { taskId, waitId, body, followUpDate }) =>
      requestJson(
        client.api.tasks[':taskId'].waits[':waitId'].$patch({
          param: {
            taskId: encodePathSegment(String(taskId)),
            waitId: encodePathSegment(waitId),
          },
          json: { body, followUpDate },
        }),
      ),
  }),
  defineOperation(waitReferenceSchema, {
    path: ['wait', 'resolve'],
    description: 'Mark a wait as resolved and acknowledged.',
    positionalArgs: ['taskId', 'waitId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/waits/:waitId/resolve'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, waitId }) =>
      requestJson(
        client.api.tasks[':taskId'].waits[':waitId'].resolve.$post({
          param: {
            taskId: encodePathSegment(String(taskId)),
            waitId: encodePathSegment(waitId),
          },
        }),
      ),
  }),
  defineOperation(waitReferenceSchema, {
    path: ['wait', 'acknowledge'],
    description: 'Acknowledge a wait that was resolved by GitHub activity.',
    positionalArgs: ['taskId', 'waitId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/waits/:waitId/acknowledge'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, waitId }) =>
      requestJson(
        client.api.tasks[':taskId'].waits[':waitId'].acknowledge.$post({
          param: {
            taskId: encodePathSegment(String(taskId)),
            waitId: encodePathSegment(waitId),
          },
        }),
      ),
  }),
  defineOperation(waitReferenceSchema, {
    path: ['wait', 'remove'],
    description: 'Delete a wait that was added by mistake.',
    positionalArgs: ['taskId', 'waitId'],
    kind: 'delete',
    routes: ['DELETE /api/tasks/:taskId/waits/:waitId'],
    cli: { output: { kind: 'none' } },
    run: (client, { taskId, waitId }) =>
      requestNoContent(
        client.api.tasks[':taskId'].waits[':waitId'].$delete({
          param: {
            taskId: encodePathSegment(String(taskId)),
            waitId: encodePathSegment(waitId),
          },
        }),
      ),
  }),
] as const

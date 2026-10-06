import { err, ok } from 'neverthrow'
import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createChecklistItemSchema,
  createChecklistSchema,
  moveChecklistItemSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
} from '#schemas/task-checklist'

const taskIdSchema = taskIdOrNumber.describe(
  'The id (UUID) or number of the task the checklist belongs to.',
)
const checklistIdSchema = pathSegmentSchema('Checklist ID').describe(
  'The id of the checklist.',
)
const itemIdSchema = pathSegmentSchema('Checklist item ID').describe(
  'The id of the checklist item.',
)

const listChecklistsSchema = z.object({ taskId: taskIdSchema })
const createChecklistInputSchema = createChecklistSchema.extend({
  taskId: taskIdSchema,
})
const checklistRefSchema = z.object({ checklistId: checklistIdSchema })
const updateChecklistInputSchema = updateChecklistSchema.extend({
  checklistId: checklistIdSchema,
})
const addChecklistItemInputSchema = createChecklistItemSchema.extend({
  checklistId: checklistIdSchema,
})
const itemRefSchema = z.object({ itemId: itemIdSchema })
const updateChecklistItemInputSchema = updateChecklistItemSchema.extend({
  itemId: itemIdSchema,
})
const moveChecklistItemInputSchema = moveChecklistItemSchema.extend({
  itemId: itemIdSchema,
})

export const checklistOperations = [
  defineOperation(listChecklistsSchema, {
    path: ['checklist', 'list'],
    description:
      'List a task’s checklists with their checklist items nested as a tree.',
    positionalArgs: ['taskId'],
    kind: 'read',
    routes: ['GET /api/tasks/:taskId/checklists'],
    cli: {
      group: { description: 'Manage task checklists', order: 1 },
      output: { kind: 'json' },
    },
    run: (client, { taskId }) =>
      requestJson(
        client.api.tasks[':taskId'].checklists.$get({
          param: { taskId: String(taskId) },
        }),
      ),
  }),
  defineOperation(createChecklistInputSchema, {
    path: ['checklist', 'create'],
    description:
      'Create an empty checklist for a task. Omit name for an unnamed checklist; sortOrder defaults to the last position.',
    positionalArgs: ['taskId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/checklists'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, ...json }) =>
      requestJson(
        client.api.tasks[':taskId'].checklists.$post({
          param: { taskId: String(taskId) },
          json,
        }),
      ),
  }),
  defineOperation(updateChecklistInputSchema, {
    path: ['checklist', 'update'],
    description:
      'Update a checklist name or position. Use --unnamed in the CLI to clear its name.',
    positionalArgs: ['checklistId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/checklists/:checklistId'],
    cli: {
      customOptions: [
        { flags: '--unnamed', description: 'Clear the checklist name' },
      ],
      mapInput: (input, options) => {
        if (options['unnamed'] !== true) return ok(input)
        if (input['name'] !== undefined) {
          return err(new Error('Use either --name or --unnamed, not both.'))
        }
        return ok({ ...input, name: null })
      },
      output: { kind: 'json' },
    },
    run: (client, { checklistId, ...json }) =>
      requestJson(
        client.api.checklists[':checklistId'].$patch({
          param: { checklistId: encodePathSegment(checklistId) },
          json,
        }),
      ),
  }),
  defineOperation(checklistRefSchema, {
    path: ['checklist', 'delete'],
    description: 'Delete a checklist and all of its items.',
    positionalArgs: ['checklistId'],
    kind: 'delete',
    routes: ['DELETE /api/checklists/:checklistId'],
    cli: { output: { kind: 'json' } },
    run: (client, { checklistId }) =>
      requestNoContent(
        client.api.checklists[':checklistId'].$delete({
          param: { checklistId: encodePathSegment(checklistId) },
        }),
      ).map(() => ({ deleted: true, checklistId })),
  }),
  defineOperation(addChecklistItemInputSchema, {
    path: ['checklist', 'item', 'add'],
    description:
      'Add a one-line checklist item, optionally nesting it under a parent. Provide Markdown detail with --note-file or stdin.',
    positionalArgs: ['checklistId', 'content'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/checklists/:checklistId/items'],
    cli: {
      contentInput: {
        field: 'note',
        required: false,
        fileOption: {
          name: 'noteFile',
          description: 'Read Markdown detail from a file instead of stdin',
        },
      },
      optionNames: { parentItemId: 'parent' },
      output: { kind: 'json' },
    },
    run: (client, { checklistId, ...json }) =>
      requestJson(
        client.api.checklists[':checklistId'].items.$post({
          param: { checklistId: encodePathSegment(checklistId) },
          json,
        }),
      ),
  }),
  defineOperation(updateChecklistItemInputSchema, {
    path: ['checklist', 'item', 'update'],
    description:
      'Update a checklist item’s one-line content or Markdown detail. Use --clear-note in the CLI to remove detail.',
    positionalArgs: ['itemId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/checklist-items/:itemId'],
    cli: {
      contentInput: {
        field: 'note',
        required: false,
        fileOption: {
          name: 'noteFile',
          description: 'Read Markdown detail from a file instead of stdin',
        },
      },
      customOptions: [
        { flags: '--clear-note', description: 'Remove Markdown detail' },
      ],
      mapInput: (input, options) => {
        if (options['clearNote'] !== true) return ok(input)
        if (options['noteFile'] !== undefined) {
          return err(
            new Error('Use either --note-file or --clear-note, not both.'),
          )
        }
        return ok({ ...input, note: null })
      },
      output: { kind: 'json' },
    },
    run: (client, { itemId, ...json }) =>
      requestJson(
        client.api['checklist-items'][':itemId'].$patch({
          param: { itemId: encodePathSegment(itemId) },
          json,
        }),
      ),
  }),
  defineOperation(itemRefSchema, {
    path: ['checklist', 'item', 'delete'],
    description: 'Delete a checklist item and its nested children.',
    positionalArgs: ['itemId'],
    kind: 'delete',
    routes: ['DELETE /api/checklist-items/:itemId'],
    cli: { output: { kind: 'json' } },
    run: (client, { itemId }) =>
      requestNoContent(
        client.api['checklist-items'][':itemId'].$delete({
          param: { itemId: encodePathSegment(itemId) },
        }),
      ).map(() => ({ deleted: true, itemId })),
  }),
  defineOperation(itemRefSchema, {
    path: ['checklist', 'item', 'check'],
    description:
      'Manually check a leaf checklist item without a linked task or pull request. Parent items are checked automatically when all their children are checked.',
    positionalArgs: ['itemId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/checklist-items/:itemId/check'],
    cli: { output: { kind: 'json' } },
    run: (client, { itemId }) =>
      requestJson(
        client.api['checklist-items'][':itemId'].check.$post({
          param: { itemId: encodePathSegment(itemId) },
        }),
      ),
  }),
  defineOperation(itemRefSchema, {
    path: ['checklist', 'item', 'uncheck'],
    description:
      'Manually uncheck a leaf checklist item without a linked task or pull request. Parent items are unchecked automatically when any child is unchecked.',
    positionalArgs: ['itemId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/checklist-items/:itemId/uncheck'],
    cli: { output: { kind: 'json' } },
    run: (client, { itemId }) =>
      requestJson(
        client.api['checklist-items'][':itemId'].uncheck.$post({
          param: { itemId: encodePathSegment(itemId) },
        }),
      ),
  }),
  defineOperation(moveChecklistItemInputSchema, {
    path: ['checklist', 'item', 'move'],
    description:
      'Move an item within its checklist by changing its parent and/or placing it after a sibling. Use --first to place it first, or --root to move it to the root.',
    positionalArgs: ['itemId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/checklist-items/:itemId/move'],
    cli: {
      customOptions: [
        { flags: '--root', description: 'Move the item to the checklist root' },
        {
          flags: '--first',
          description: 'Place the item first among siblings',
        },
      ],
      optionNames: { parentItemId: 'parent', afterItemId: 'after' },
      mapInput: (input, options) => {
        if (options['root'] === true && input['parentItemId'] !== undefined) {
          return err(new Error('Use either --parent or --root, not both.'))
        }
        if (options['first'] === true && input['afterItemId'] !== undefined) {
          return err(new Error('Use either --after or --first, not both.'))
        }
        return ok({
          ...input,
          ...(options['root'] === true ? { parentItemId: null } : {}),
          ...(options['first'] === true ? { afterItemId: null } : {}),
        })
      },
      output: { kind: 'json' },
    },
    run: (client, { itemId, ...json }) =>
      requestJson(
        client.api['checklist-items'][':itemId'].move.$patch({
          param: { itemId: encodePathSegment(itemId) },
          json,
        }),
      ),
  }),
] as const

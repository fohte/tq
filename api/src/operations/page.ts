import { z } from 'zod'

import { taskIdOrNumber } from '#lib/numeric-id'
import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  omitKeyRecursively,
  requestJson,
  requestNoContent,
} from '#operations/types'
import { createPageSchema, updatePageSchema } from '#schemas/task-page'

const pageContentKey = 'content'

const taskIdSchema = taskIdOrNumber.describe(
  'The id (UUID) or number of the task the page belongs to.',
)
const pageIdSchema = pathSegmentSchema('Page ID').describe(
  'The id of the page.',
)

const searchPagesSchema = z.object({
  q: z
    .string()
    .trim()
    .min(1)
    .describe('Free-text phrase to search across pages, comments, and tasks.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional()
    .describe(
      'Maximum number of matching locations to return (1-50). Defaults to 20.',
    ),
})
const listPagesSchema = z.object({
  taskId: taskIdSchema,
  full: z.boolean().optional().describe('Include full page content.'),
})
const pageRefSchema = z.object({ taskId: taskIdSchema, pageId: pageIdSchema })
const createPageInputSchema = createPageSchema.extend({ taskId: taskIdSchema })
const updatePageInputSchema = updatePageSchema.extend({
  taskId: taskIdSchema,
  pageId: pageIdSchema,
})

export const pageOperations = [
  defineOperation(searchPagesSchema, {
    path: ['page', 'search'],
    description:
      'Find where a phrase appears across task pages, comments, and task title or description. Returns matching locations with the task number, page identity when applicable, a snippet, and match metadata; it does not return page content. Fetch a full page by its task number and page id when needed.',
    positionalArgs: ['q'],
    kind: 'read',
    routes: ['GET /api/tasks/search/pages'],
    cli: {
      group: { description: 'Manage task pages', order: 0 },
      output: { kind: 'json' },
    },
    run: (client, { q, limit }) =>
      requestJson(
        client.api.tasks.search.pages.$get({
          query: {
            q,
            ...(limit === undefined ? {} : { limit: String(limit) }),
          },
        }),
      ),
  }),
  defineOperation(listPagesSchema, {
    path: ['page', 'list'],
    description:
      'List pages for a task. Returns metadata by default; set full to true to include page content. Task details also include page metadata without content.',
    positionalArgs: ['taskId'],
    kind: 'read',
    routes: ['GET /api/tasks/:taskId/pages'],
    cli: {
      output: {
        kind: 'list',
        omitKey: pageContentKey,
        fullOption: '--full',
        fullDescription: 'Include full page content in the output',
        fullField: 'full',
      },
    },
    run: (client, { taskId, full }) =>
      requestJson(
        client.api.tasks[':taskId'].pages.$get({
          param: { taskId: String(taskId) },
        }),
      ).map((result) =>
        full === true ? result : omitKeyRecursively(result, pageContentKey),
      ),
  }),
  defineOperation(pageRefSchema, {
    path: ['page', 'get'],
    description:
      'Get the full content of a single page (a task note) by id. Resolve taskId and pageId from a page listing or task detail; task detail contains page metadata without content.',
    positionalArgs: ['taskId', 'pageId'],
    kind: 'read',
    routes: ['GET /api/tasks/:taskId/pages/:pageId'],
    cli: {
      output: {
        kind: 'json',
        fileOutput: {
          kind: 'content',
          option: {
            name: 'output',
            description: 'Write the page content to a file instead of stdout',
          },
          field: pageContentKey,
        },
      },
    },
    run: (client, { taskId, pageId }) =>
      requestJson(
        client.api.tasks[':taskId'].pages[':pageId'].$get({
          param: {
            taskId: String(taskId),
            pageId: encodePathSegment(pageId),
          },
        }),
      ),
  }),
  defineOperation(createPageInputSchema, {
    path: ['page', 'create'],
    description:
      'Create a new page under a task. Pages hold longer-form content associated with a task, separate from the task description. HTML pages render in a sandboxed iframe with no access to app cookies, localStorage, or API; inline CSS and JavaScript because external resources may not remain reachable. sortOrder controls display order among the task pages and defaults to 0.',
    positionalArgs: ['taskId', 'title'],
    kind: 'write',
    attribution: 'agent',
    routes: ['POST /api/tasks/:taskId/pages'],
    cli: {
      contentInput: { field: pageContentKey, required: false },
      output: { kind: 'json-with-link-sync' },
    },
    run: (client, { taskId, ...json }) =>
      requestJson(
        client.api.tasks[':taskId'].pages.$post({
          param: { taskId: String(taskId) },
          json,
        }),
      ),
  }),
  defineOperation(updatePageInputSchema, {
    path: ['page', 'update'],
    description:
      'Partially update an existing page by task id and page id. Only provided fields are changed; omit a field to leave it as-is.',
    positionalArgs: ['taskId', 'pageId'],
    kind: 'write',
    attribution: 'agent',
    routes: ['PATCH /api/tasks/:taskId/pages/:pageId'],
    cli: {
      contentInput: { field: pageContentKey, required: false },
      output: { kind: 'json-with-link-sync' },
    },
    run: (client, { taskId, pageId, ...json }) =>
      requestJson(
        client.api.tasks[':taskId'].pages[':pageId'].$patch({
          param: {
            taskId: String(taskId),
            pageId: encodePathSegment(pageId),
          },
          json,
        }),
      ),
  }),
  defineOperation(pageRefSchema, {
    path: ['page', 'delete'],
    description: 'Delete a page from a task.',
    positionalArgs: ['taskId', 'pageId'],
    kind: 'delete',
    routes: ['DELETE /api/tasks/:taskId/pages/:pageId'],
    cli: { output: { kind: 'json' } },
    run: (client, { taskId, pageId }) =>
      requestNoContent(
        client.api.tasks[':taskId'].pages[':pageId'].$delete({
          param: {
            taskId: String(taskId),
            pageId: encodePathSegment(pageId),
          },
        }),
      ).map(() => ({ deleted: true, taskId: String(taskId), pageId })),
  }),
] as const

import { z } from 'zod'

import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createProjectSchema,
  listProjectsQuerySchema,
  updateProjectSchema,
} from '#schemas/project'

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const nextCode = value.charCodeAt(index + 1)
      if (!(nextCode >= 0xdc00 && nextCode <= 0xdfff)) return false
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false
    }
  }
  return true
}

const projectId = z
  .string()
  .min(1)
  .refine(
    (id) =>
      id !== '.' &&
      id !== '..' &&
      !id.includes('/') &&
      !id.includes('\\') &&
      isWellFormedUnicode(id),
    { message: 'Project ID must be a single path segment' },
  )
const projectIdSchema = z.object({ id: projectId })
const createProjectInputSchema = createProjectSchema
const updateProjectInputSchema = updateProjectSchema.extend({ id: projectId })

export const projectOperations = [
  defineOperation(listProjectsQuerySchema, {
    path: ['project', 'list'],
    description:
      'List projects, optionally filtered by title, status, or context. Use the returned ids to scope project commands and task queries.',
    positionalArgs: [],
    kind: 'read',
    routes: ['GET /api/projects'],
    cli: {
      output: {
        kind: 'list',
        omitKey: 'description',
        fullOption: '--full',
        fullDescription: 'Include full project description in the output',
      },
    },
    run: (client, query) => requestJson(client.api.projects.$get({ query })),
  }),
  defineOperation(projectIdSchema, {
    path: ['project', 'get'],
    description: 'Get a project by id.',
    positionalArgs: ['id'],
    kind: 'read',
    routes: ['GET /api/projects/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestJson(
        client.api.projects[':id'].$get({
          param: { id: encodeURIComponent(id) },
        }),
      ),
  }),
  defineOperation(createProjectInputSchema, {
    path: ['project', 'create'],
    description: 'Create a project.',
    positionalArgs: ['title'],
    kind: 'write',
    routes: ['POST /api/projects'],
    cli: { output: { kind: 'json' } },
    run: (client, json) => requestJson(client.api.projects.$post({ json })),
  }),
  defineOperation(updateProjectInputSchema, {
    path: ['project', 'update'],
    description: 'Update a project.',
    positionalArgs: ['id'],
    kind: 'write',
    routes: ['PATCH /api/projects/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id, ...json }) =>
      requestJson(
        client.api.projects[':id'].$patch({
          param: { id: encodeURIComponent(id) },
          json,
        }),
      ),
  }),
  defineOperation(projectIdSchema, {
    path: ['project', 'delete'],
    description: 'Delete a project.',
    positionalArgs: ['id'],
    kind: 'delete',
    routes: ['DELETE /api/projects/:id'],
    cli: { output: { kind: 'json' } },
    run: (client, { id }) =>
      requestNoContent(
        client.api.projects[':id'].$delete({
          param: { id: encodeURIComponent(id) },
        }),
      ).map(() => ({ deleted: true, id })),
  }),
  defineOperation(projectIdSchema, {
    path: ['project', 'tasks'],
    description: 'List tasks in a project.',
    positionalArgs: ['id'],
    kind: 'read',
    routes: ['GET /api/projects/:id', 'GET /api/tasks'],
    cli: {
      output: {
        kind: 'list',
        omitKey: 'description',
        fullOption: '--full',
        fullDescription: 'Include full task description in the output',
      },
    },
    // The tasks query does not check project existence, so retain the lookup
    // to preserve the CLI's 404 behavior for unknown project ids.
    run: (client, { id }) =>
      requestJson(
        client.api.projects[':id'].$get({
          param: { id: encodeURIComponent(id) },
        }),
      ).andThen(() =>
        requestJson(client.api.tasks.$get({ query: { projectId: id } })),
      ),
  }),
] as const

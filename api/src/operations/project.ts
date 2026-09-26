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

const projectIdSchema = z.object({ id: z.string() })
const createProjectInputSchema = createProjectSchema
const updateProjectInputSchema = updateProjectSchema.extend({ id: z.string() })

export const projectOperations = [
  defineOperation(listProjectsQuerySchema, {
    path: ['project', 'list'],
    description:
      "List projects, optionally filtered by title, status, or context. Use this to resolve a project's id before passing it to project_tasks or a task command.",
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
      requestJson(client.api.projects[':id'].$get({ param: { id } })),
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
      requestJson(client.api.projects[':id'].$patch({ param: { id }, json })),
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
        client.api.projects[':id'].$delete({ param: { id } }),
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
      requestJson(client.api.projects[':id'].$get({ param: { id } })).andThen(
        () => requestJson(client.api.tasks.$get({ query: { projectId: id } })),
      ),
  }),
] as const

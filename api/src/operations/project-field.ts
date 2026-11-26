import { z } from 'zod'

import { encodePathSegment, pathSegmentSchema } from '#operations/path-segment'
import {
  defineOperation,
  requestJson,
  requestNoContent,
} from '#operations/types'
import {
  createProjectFieldOptionSchema,
  createProjectFieldSchema,
  updateProjectFieldOptionSchema,
  updateProjectFieldSchema,
} from '#schemas/project-field'

const projectId = pathSegmentSchema('Project ID').refine(
  (id) => !id.includes('/') && !id.includes('\\'),
  { message: 'Project ID must be a single path segment' },
)
const fieldId = z.uuid()
const optionId = z.uuid()
const projectFieldsInputSchema = z.object({ projectId })
const projectFieldInputSchema = projectFieldsInputSchema.extend({ fieldId })
const projectFieldOptionInputSchema = projectFieldInputSchema.extend({
  optionId,
})
const createProjectFieldInputSchema = createProjectFieldSchema.extend({
  projectId,
})
const updateProjectFieldInputSchema = updateProjectFieldSchema.extend({
  projectId,
  fieldId,
})
const createProjectFieldOptionInputSchema =
  createProjectFieldOptionSchema.extend({ projectId, fieldId })
const updateProjectFieldOptionInputSchema =
  updateProjectFieldOptionSchema.extend({ projectId, fieldId, optionId })

export const projectFieldOperations = [
  defineOperation(projectFieldsInputSchema, {
    path: ['project', 'field', 'list'],
    description: 'List the custom fields and options for a project.',
    positionalArgs: ['projectId'],
    kind: 'read',
    routes: ['GET /api/projects/:projectId/fields'],
    cli: { output: { kind: 'list', omitKey: 'description' } },
    run: (client, { projectId }) =>
      requestJson(
        client.api.projects[':projectId'].fields.$get({
          param: { projectId: encodePathSegment(projectId) },
        }),
      ),
  }),
  defineOperation(createProjectFieldInputSchema, {
    path: ['project', 'field', 'create'],
    description: 'Create a custom field for a project.',
    positionalArgs: ['projectId', 'name'],
    kind: 'write',
    routes: ['POST /api/projects/:projectId/fields'],
    cli: {
      excludeFields: ['type'],
      commaSeparatedOptions: ['options'],
      optionMetavars: { options: 'names' },
      output: { kind: 'json' },
    },
    run: (client, { projectId, name, type, options }) =>
      requestJson(
        client.api.projects[':projectId'].fields.$post({
          param: { projectId: encodePathSegment(projectId) },
          json: { name, type, options },
        }),
      ),
  }),
  defineOperation(updateProjectFieldInputSchema, {
    path: ['project', 'field', 'update'],
    description: 'Rename a custom field.',
    positionalArgs: ['projectId', 'fieldId', 'name'],
    kind: 'write',
    routes: ['PATCH /api/projects/:projectId/fields/:fieldId'],
    cli: { output: { kind: 'json' } },
    run: (client, { projectId, fieldId, name }) =>
      requestJson(
        client.api.projects[':projectId'].fields[':fieldId'].$patch({
          param: {
            projectId: encodePathSegment(projectId),
            fieldId: encodePathSegment(fieldId),
          },
          json: { name },
        }),
      ),
  }),
  defineOperation(projectFieldInputSchema, {
    path: ['project', 'field', 'delete'],
    description: 'Delete a custom field and all its options.',
    positionalArgs: ['projectId', 'fieldId'],
    kind: 'delete',
    routes: ['DELETE /api/projects/:projectId/fields/:fieldId'],
    cli: { output: { kind: 'none' } },
    run: (client, { projectId, fieldId }) =>
      requestNoContent(
        client.api.projects[':projectId'].fields[':fieldId'].$delete({
          param: {
            projectId: encodePathSegment(projectId),
            fieldId: encodePathSegment(fieldId),
          },
        }),
      ),
  }),
  defineOperation(createProjectFieldOptionInputSchema, {
    path: ['project', 'field', 'option', 'create'],
    description: 'Create an option for a custom field.',
    positionalArgs: ['projectId', 'fieldId', 'name'],
    kind: 'write',
    routes: ['POST /api/projects/:projectId/fields/:fieldId/options'],
    cli: { output: { kind: 'json' } },
    run: (client, { projectId, fieldId, name }) =>
      requestJson(
        client.api.projects[':projectId'].fields[':fieldId'].options.$post({
          param: {
            projectId: encodePathSegment(projectId),
            fieldId: encodePathSegment(fieldId),
          },
          json: { name },
        }),
      ),
  }),
  defineOperation(updateProjectFieldOptionInputSchema, {
    path: ['project', 'field', 'option', 'update'],
    description: 'Rename an option of a custom field.',
    positionalArgs: ['projectId', 'fieldId', 'optionId', 'name'],
    kind: 'write',
    routes: [
      'PATCH /api/projects/:projectId/fields/:fieldId/options/:optionId',
    ],
    cli: { output: { kind: 'json' } },
    run: (client, { projectId, fieldId, optionId, name }) =>
      requestJson(
        client.api.projects[':projectId'].fields[':fieldId'].options[
          ':optionId'
        ].$patch({
          param: {
            projectId: encodePathSegment(projectId),
            fieldId: encodePathSegment(fieldId),
            optionId: encodePathSegment(optionId),
          },
          json: { name },
        }),
      ),
  }),
  defineOperation(projectFieldOptionInputSchema, {
    path: ['project', 'field', 'option', 'delete'],
    description: 'Delete an option from a custom field.',
    positionalArgs: ['projectId', 'fieldId', 'optionId'],
    kind: 'delete',
    routes: [
      'DELETE /api/projects/:projectId/fields/:fieldId/options/:optionId',
    ],
    cli: { output: { kind: 'none' } },
    run: (client, { projectId, fieldId, optionId }) =>
      requestNoContent(
        client.api.projects[':projectId'].fields[':fieldId'].options[
          ':optionId'
        ].$delete({
          param: {
            projectId: encodePathSegment(projectId),
            fieldId: encodePathSegment(fieldId),
            optionId: encodePathSegment(optionId),
          },
        }),
      ),
  }),
] as const

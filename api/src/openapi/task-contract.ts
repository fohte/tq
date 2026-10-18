import { z } from 'zod'

import { createTaskSchema } from '#schemas/task'
import { createTaskResponseSchema } from '#schemas/task-response'
import { taskStatusChangedWebhookEventSchema } from '#schemas/webhook'

const createTaskRequestSchema = z.toJSONSchema(createTaskSchema, {
  target: 'openapi-3.0',
  io: 'input',
})

const createTaskResponseJsonSchema = z.toJSONSchema(createTaskResponseSchema, {
  target: 'openapi-3.0',
  io: 'input',
})
const githubLinkLookupQueryUrlSchema = z.toJSONSchema(z.string().min(1), {
  target: 'openapi-3.0',
  io: 'input',
})
const githubLinkLookupResponseSchema = z.toJSONSchema(
  z.object({
    task: createTaskResponseSchema.omit({ linkSync: true }).nullable(),
  }),
  { target: 'openapi-3.0', io: 'input' },
)
const taskStatusChangedWebhookEventJsonSchema = z.toJSONSchema(
  taskStatusChangedWebhookEventSchema,
  { target: 'openapi-3.0', io: 'input' },
)

export const openApiDocument = {
  openapi: '3.0.0',
  info: {
    title: 'tq API',
    version: '1.0.0',
  },
  paths: {
    '/api/tasks': {
      post: {
        tags: ['Tasks'],
        operationId: 'createTask',
        summary: 'Create a task',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateTaskRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'The created task',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTaskResponse' },
              },
            },
          },
        },
      },
    },
    '/api/github/link': {
      get: {
        tags: ['GitHub'],
        operationId: 'getGithubLink',
        summary: 'Get the task linked to a GitHub URL',
        parameters: [
          {
            name: 'url',
            in: 'query',
            required: true,
            description: 'GitHub issue or pull request URL.',
            schema: githubLinkLookupQueryUrlSchema,
          },
        ],
        responses: {
          '200': {
            description: 'The linked task, or null if no task is linked',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/GithubLinkLookupResponse',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      CreateTaskRequest: createTaskRequestSchema,
      CreateTaskResponse: createTaskResponseJsonSchema,
      GithubLinkLookupResponse: githubLinkLookupResponseSchema,
      TaskStatusChangedWebhookEvent: taskStatusChangedWebhookEventJsonSchema,
    },
  },
} as const

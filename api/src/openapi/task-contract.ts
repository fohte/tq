import { z } from 'zod'

import { createTaskSchema } from '#schemas/task'
import { createTaskResponseSchema } from '#schemas/task-response'

const createTaskRequestSchema = z.toJSONSchema(createTaskSchema, {
  target: 'openapi-3.0',
  io: 'input',
})

const createTaskResponseJsonSchema = z.toJSONSchema(createTaskResponseSchema, {
  target: 'openapi-3.0',
  io: 'input',
})

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
  },
  components: {
    schemas: {
      CreateTaskRequest: createTaskRequestSchema,
      CreateTaskResponse: createTaskResponseJsonSchema,
    },
  },
} as const

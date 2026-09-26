import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import {
  type CallToolResult,
  CallToolResultSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { operations } from '#operations/index'
import {
  createComment,
  createLabel,
  createTask,
  TEST_UUID,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// `number` is a per-suite-run sequential value (the sequence isn't rolled
// back with the surrounding test transaction), so it's normalized like the
// uuid/timestamp fields rather than asserted on directly. `skipKeys` opts a
// key out of uuid/timestamp normalization for callers that already know its
// real value (e.g. a page/comment response's `taskId`, or an updated
// resource's own `id`) and want to assert on that value directly instead of
// blurring it into a placeholder.
function normalizeDynamicValues(
  value: unknown,
  key: string | undefined,
  skipKeys: ReadonlySet<string>,
): unknown {
  if (key != null && skipKeys.has(key)) return value
  if (key === 'number' && typeof value === 'number') return '<number>'
  if (typeof value === 'string') {
    if (UUID_PATTERN.test(value)) return '<uuid>'
    if (TIMESTAMP_PATTERN.test(value)) return '<timestamp>'
    return value
  }
  if (Array.isArray(value)) {
    return value.map((v) => normalizeDynamicValues(v, undefined, skipKeys))
  }
  if (value != null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        normalizeDynamicValues(v, k, skipKeys),
      ]),
    )
  }
  return value
}

function parseToolJson(result: CallToolResult): unknown {
  const [first] = result.content
  if (first?.type !== 'text') throw new Error('expected text content')
  return JSON.parse(first.text)
}

function parseToolData(
  result: CallToolResult,
  skipKeys: readonly string[] = [],
): unknown {
  return normalizeDynamicValues(
    parseToolJson(result),
    undefined,
    new Set(skipKeys),
  )
}

async function createProject(title: string): Promise<{ id: string }> {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

async function projectTitle(projectId: string): Promise<string> {
  const response = await app.request(`/api/projects/${projectId}`)
  const project = await jsonBody(response, z.object({ title: z.string() }))
  return project.title
}

function summarizeTraversal(result: CallToolResult, projectTitle: string) {
  return { result, projectTitle }
}

let client: Client

beforeEach(async () => {
  client = new Client({ name: 'test-client', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(
    new URL('http://localhost/api/mcp'),
    { fetch: async (url, init) => app.request(url, init) },
  )
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see index.integration.test.ts
  await client.connect(transport as Transport)
})

afterEach(async () => {
  await client.close()
})

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  const result = await client.callTool(
    { name, arguments: args },
    CallToolResultSchema,
  )
  // `callTool`'s return type is the same content/toolResult union regardless
  // of which `resultSchema` is passed, so passing `CallToolResultSchema`
  // guarantees the `content` shape at runtime without narrowing the type.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- see comment above
  return result as CallToolResult
}

async function summarizeToolCallOutcome(
  name: string,
  args: Record<string, unknown>,
) {
  try {
    return { kind: 'result' as const, result: await callTool(name, args) }
  } catch (error) {
    return error instanceof McpError
      ? { kind: 'mcp-error' as const, code: error.code }
      : {
          kind: 'unexpected-error' as const,
          message: error instanceof Error ? error.message : String(error),
        }
  }
}

function expectedPathSegmentValidationError(
  name: string,
  field: string,
  label: string,
  value: string,
) {
  const issue =
    value === ''
      ? 'Too small: expected string to have >=1 characters'
      : `${label} must be a valid path segment`
  return {
    kind: 'result',
    result: {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Input validation error: Invalid arguments for tool ${name}: ${field}: ${issue}`,
        },
      ],
    },
  }
}

describe('write tools', () => {
  describe('comment_create tool', () => {
    it('creates a comment, attributed to the default mcp agent', async () => {
      const task = await createTask('Has comments')

      const result = await callTool('comment_create', {
        taskId: task.id,
        content: 'A comment',
      })

      expect(parseToolData(result, ['taskId'])).toEqual({
        id: '<uuid>',
        taskId: task.id,
        content: 'A comment',
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'mcp' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('attributes the comment to an explicitly passed agent', async () => {
      const task = await createTask('Has comments')

      const result = await callTool('comment_create', {
        taskId: task.id,
        content: 'A comment',
        agent: 'test-agent',
      })

      expect(parseToolData(result, ['taskId'])).toEqual({
        id: '<uuid>',
        taskId: task.id,
        content: 'A comment',
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'test-agent' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('rejects a non-existent taskId', async () => {
      const result = await callTool('comment_create', {
        taskId: TEST_UUID,
        content: 'Orphan comment',
      })

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Task not found' }],
      })
    })
  })

  describe('comment_update tool', () => {
    it('rejects empty and dot comment ids before tool execution', async () => {
      const outcomes = await Promise.all(
        ['comment_update', 'comment_delete'].flatMap((name) =>
          ['', '.', '..'].map((commentId) =>
            summarizeToolCallOutcome(
              name,
              name === 'comment_update'
                ? { taskId: TEST_UUID, commentId, content: 'Updated content' }
                : { taskId: TEST_UUID, commentId },
            ),
          ),
        ),
      )

      expect(outcomes).toEqual(
        ['comment_update', 'comment_delete'].flatMap((name) =>
          ['', '.', '..'].map((commentId) =>
            expectedPathSegmentValidationError(
              name,
              'commentId',
              'Comment ID',
              commentId,
            ),
          ),
        ),
      )
    })

    it('updates the comment content', async () => {
      const task = await createTask('Has comments')
      const comment = await createComment(task.id, 'Original content')

      const result = await callTool('comment_update', {
        taskId: task.id,
        commentId: comment.id,
        content: 'Updated content',
      })

      expect(parseToolData(result, ['id', 'taskId'])).toEqual({
        id: comment.id,
        taskId: task.id,
        content: 'Updated content',
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'mcp' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('attributes the update to an explicitly passed agent', async () => {
      const task = await createTask('Has comments')
      const comment = await createComment(task.id, 'Original content')

      const result = await callTool('comment_update', {
        taskId: task.id,
        commentId: comment.id,
        content: 'Updated content',
        agent: 'test-agent',
      })

      expect(parseToolData(result, ['id', 'taskId'])).toEqual({
        id: comment.id,
        taskId: task.id,
        content: 'Updated content',
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        author: { kind: 'llm', agent: 'test-agent' },
        linkSync: { outgoing: [], unresolvedRefs: [] },
      })
    })

    it('rejects a non-existent commentId', async () => {
      const task = await createTask('Has comments')

      const result = await callTool('comment_update', {
        taskId: task.id,
        commentId: TEST_UUID,
        content: 'Updated content',
      })

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Comment not found' }],
      })
    })

    it('accepts a synthetic comment id and lets the API report it missing', async () => {
      const task = await createTask('Has comments')

      const result = await callTool('comment_update', {
        taskId: task.id,
        commentId: 'c1',
        content: 'Updated content',
      })

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Comment not found' }],
      })
    })

    it('does not route a traversal comment id to a project update', async () => {
      const project = await createProject('Original project')
      const task = await createTask('Has comments')

      const result = await callTool('comment_update', {
        taskId: task.id,
        commentId: `../../../projects/${project.id}`,
        content: 'Changed project',
      })

      expect(
        summarizeTraversal(result, await projectTitle(project.id)),
      ).toEqual({
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Comment not found' }],
        },
        projectTitle: 'Original project',
      })
    })
  })

  describe('comment_list tool', () => {
    it('returns comments with their full content', async () => {
      const task = await createTask('Has comments')
      await createComment(task.id, 'A long comment body')

      const result = await callTool('comment_list', { taskId: task.id })

      expect(parseToolData(result, ['taskId'])).toEqual([
        {
          id: '<uuid>',
          taskId: task.id,
          content: 'A long comment body',
          createdAt: '<timestamp>',
          updatedAt: '<timestamp>',
          author: { kind: 'human', agent: null },
        },
      ])
    })
  })

  describe('comment_delete tool', () => {
    it('returns a confirmation after deleting a comment', async () => {
      const task = await createTask('Has comments')
      const comment = await createComment(task.id, 'Delete this comment')

      const result = await callTool('comment_delete', {
        taskId: task.id,
        commentId: comment.id,
      })

      expect(parseToolData(result, ['taskId', 'commentId'])).toEqual({
        deleted: true,
        taskId: task.id,
        commentId: comment.id,
      })
    })

    it('removes the comment from the task list', async () => {
      const task = await createTask('Has comments')
      const comment = await createComment(task.id, 'Delete this comment')
      await callTool('comment_delete', {
        taskId: task.id,
        commentId: comment.id,
      })

      const commentsResponse = await app.request(
        `/api/tasks/${task.id}/comments`,
      )

      expect(await jsonBody(commentsResponse)).toEqual([])
    })

    it('returns not found for an unknown comment', async () => {
      const task = await createTask('Has comments')

      const result = await callTool('comment_delete', {
        taskId: task.id,
        commentId: TEST_UUID,
      })

      expect(result).toEqual({
        isError: true,
        content: [{ type: 'text', text: 'Comment not found' }],
      })
    })

    it('does not route a traversal comment id to a project deletion', async () => {
      const project = await createProject('Original project')
      const task = await createTask('Has comments')

      const result = await callTool('comment_delete', {
        taskId: task.id,
        commentId: `../../../projects/${project.id}`,
      })

      expect(
        summarizeTraversal(result, await projectTitle(project.id)),
      ).toEqual({
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Comment not found' }],
        },
        projectTitle: 'Original project',
      })
    })
  })

  describe('label_update tool', () => {
    it('rejects empty and dot ids before tool execution', async () => {
      const outcomes = await Promise.all(
        ['label_update', 'label_delete'].flatMap((name) =>
          ['', '.', '..'].map((id) =>
            summarizeToolCallOutcome(
              name,
              name === 'label_update' ? { id, name: 'renamed-label' } : { id },
            ),
          ),
        ),
      )

      expect(outcomes).toEqual(
        ['label_update', 'label_delete'].flatMap((name) =>
          ['', '.', '..'].map((id) =>
            expectedPathSegmentValidationError(name, 'id', 'Label ID', id),
          ),
        ),
      )
    })

    it('updates a label by id', async () => {
      const label = await createLabel('operation-label', {
        context: 'personal',
      })

      const result = await callTool('label_update', {
        id: label.id,
        name: 'renamed-operation-label',
        context: 'work',
      })

      expect(parseToolData(result, ['id'])).toEqual({
        id: label.id,
        name: 'renamed-operation-label',
        color: null,
        context: 'work',
        createdAt: '<timestamp>',
      })
    })

    it('does not route a traversal label id to a project update', async () => {
      const project = await createProject('Original project')

      const result = await callTool('label_update', {
        id: `../projects/${project.id}`,
        name: 'Changed project',
      })

      expect(
        summarizeTraversal(result, await projectTitle(project.id)),
      ).toEqual({
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Label not found' }],
        },
        projectTitle: 'Original project',
      })
    })
  })

  describe('label_delete tool', () => {
    it('returns a confirmation after deleting a label', async () => {
      const label = await createLabel('label-for-deletion', { context: 'work' })
      const result = await callTool('label_delete', { id: label.id })

      expect(parseToolData(result, ['id'])).toEqual({
        deleted: true,
        id: label.id,
      })
    })

    it('removes the label from the label list', async () => {
      const label = await createLabel('label-for-deletion', { context: 'work' })
      await callTool('label_delete', { id: label.id })

      const response = await app.request('/api/labels?context=work')

      expect(await jsonBody(response)).toEqual([])
    })

    it('does not route a traversal label id to a project deletion', async () => {
      const project = await createProject('Original project')

      const result = await callTool('label_delete', {
        id: `../projects/${project.id}`,
      })

      expect(
        summarizeTraversal(result, await projectTitle(project.id)),
      ).toEqual({
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Label not found' }],
        },
        projectTitle: 'Original project',
      })
    })
  })

  describe('operation tool input schemas', () => {
    it('exposes agent only for operations that support attribution', async () => {
      const tools = await client.listTools()
      const operationToolNames = operations.map((operation) =>
        operation.path.join('_'),
      )
      const agentArguments = Object.fromEntries(
        tools.tools
          .filter((tool) => operationToolNames.includes(tool.name))
          .map((tool) => [
            tool.name,
            Object.keys(tool.inputSchema.properties ?? {}).includes('agent'),
          ]),
      )

      expect(agentArguments).toEqual({
        comment_create: true,
        comment_delete: false,
        comment_list: false,
        comment_update: true,
        label_delete: false,
        label_list: false,
        label_update: false,
        project_create: false,
        project_delete: false,
        project_get: false,
        project_list: false,
        project_tasks: false,
        project_update: false,
      })
    })
  })

  describe('operation tool annotations', () => {
    it('maps operation kinds to MCP annotations', async () => {
      const tools = await client.listTools()
      const annotations = Object.fromEntries(
        tools.tools
          .filter(
            (tool) =>
              tool.name.startsWith('comment_') ||
              tool.name.startsWith('label_'),
          )
          .map((tool) => [tool.name, tool.annotations ?? null]),
      )

      expect(annotations).toEqual({
        comment_create: {
          readOnlyHint: false,
          destructiveHint: false,
        },
        comment_delete: {
          readOnlyHint: false,
          destructiveHint: true,
        },
        comment_list: { readOnlyHint: true },
        comment_update: {
          readOnlyHint: false,
          destructiveHint: false,
        },
        label_delete: {
          readOnlyHint: false,
          destructiveHint: true,
        },
        label_list: { readOnlyHint: true },
        label_update: {
          readOnlyHint: false,
          destructiveHint: false,
        },
      })
    })
  })
})

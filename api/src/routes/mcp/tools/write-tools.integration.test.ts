import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  type CallToolResult,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import { McpServer } from '@modelcontextprotocol/server'
import { okAsync } from 'neverthrow'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { operations } from '#operations/index'
import {
  callMcpTool,
  connectMcpClient,
  expectedPathSegmentValidationError as expectedMcpPathSegmentValidationError,
  parseToolData,
} from '#routes/mcp/testing'
import { registerOperationTools } from '#routes/mcp/tools/operation-tools'
import {
  createComment,
  createLabel,
  createTask,
  TEST_UUID,
} from '#routes/tasks/testing'
import * as r2 from '#services/r2'
import { jsonBody, makeFile, setupTestDb } from '#testing'

vi.mock('#services/r2')
setupTestDb()

async function createProject(title: string): Promise<{ id: string }> {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

async function createAsset(): Promise<{ id: string }> {
  const form = new FormData()
  form.set('file', makeFile('sample.png', 'image/png', 1))
  const response = await app.request('/api/assets', {
    method: 'POST',
    body: form,
  })
  return jsonBody(response, z.object({ id: z.uuid() }))
}

async function createAgentSession(sessionId: string): Promise<void> {
  const response = await app.request('/api/agent-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'claude_code',
      sessionId,
      cwd: '/tmp/example',
      label: 'Archive test session',
      lastMessage: null,
    }),
  })
  await jsonBody(response, z.object({ id: z.uuid() }))
}

async function projectTitle(projectId: string): Promise<string> {
  const response = await app.request(`/api/projects/${projectId}`)
  const project = await jsonBody(response, z.object({ title: z.string() }))
  return project.title
}

function summarizeTraversal(result: CallToolResult, projectTitle: string) {
  return { result, projectTitle }
}

function summarizeSessionDeleteTraversal(
  result: CallToolResult,
  taskStatus: number,
  task: { title: string },
) {
  return { result, task: { status: taskStatus, body: task } }
}

function summarizeAssetDelete(result: CallToolResult, assetStatus: number) {
  return { result: parseToolData(result, ['id']), assetStatus }
}

let client: Client

beforeEach(async () => {
  vi.mocked(r2.putObject).mockReset().mockReturnValue(okAsync(undefined))
  vi.mocked(r2.getObjectSignedUrl)
    .mockReset()
    .mockReturnValue(okAsync('https://signed.example/assets/test'))
  vi.mocked(r2.deleteObjectByKey)
    .mockReset()
    .mockReturnValue(okAsync(undefined))
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

async function summarizeToolCallOutcome(
  name: string,
  args: Record<string, unknown>,
) {
  try {
    return {
      kind: 'result' as const,
      result: await callMcpTool(client, name, args),
    }
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
  return {
    kind: 'result',
    result: expectedMcpPathSegmentValidationError(name, field, label, value),
  }
}

describe('comment_create tool', () => {
  it('creates a comment, attributed to the default mcp agent', async () => {
    const task = await createTask('Has comments')

    const result = await callMcpTool(client, 'comment_create', {
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

    const result = await callMcpTool(client, 'comment_create', {
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
    const result = await callMcpTool(client, 'comment_create', {
      taskId: TEST_UUID,
      content: 'Orphan comment',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })
})

describe('session_delete tool', () => {
  it('rejects empty, dot, and dot-dot provider and session ids', async () => {
    const invalidSegments = ['', '.', '..']
    const cases = [
      ...invalidSegments.map((value) => ({
        field: 'provider',
        label: 'Provider',
        value,
      })),
      ...invalidSegments.map((value) => ({
        field: 'sessionId',
        label: 'Session ID',
        value,
      })),
    ]
    const outcomes = await Promise.all(
      cases.map(({ field, value }) =>
        summarizeToolCallOutcome('session_delete', {
          provider: field === 'provider' ? value : 'claude_code',
          sessionId: field === 'sessionId' ? value : 'session-id',
        }),
      ),
    )

    expect(outcomes).toEqual(
      cases.map(({ field, label, value }) =>
        expectedPathSegmentValidationError(
          'session_delete',
          field,
          label,
          value,
        ),
      ),
    )
  })

  it('does not route an encoded session id to a task deletion', async () => {
    const task = await createTask('Protected test task')
    const result = await callMcpTool(client, 'session_delete', {
      provider: 'claude_code',
      sessionId: `../../../tasks/${task.id}`,
    })
    const taskResponse = await app.request(`/api/tasks/${task.id}`)
    const currentTask = await jsonBody(
      taskResponse,
      z.object({ title: z.string() }),
    )

    expect(
      summarizeSessionDeleteTraversal(result, taskResponse.status, currentTask),
    ).toEqual({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Agent session not found' }],
      },
      task: { status: 200, body: { title: 'Protected test task' } },
    })
  })
})

describe('session_archive tool', () => {
  it('archives an agent session', async () => {
    await createAgentSession('archive-session-1')

    const result = await callMcpTool(client, 'session_archive', {
      provider: 'claude_code',
      sessionId: 'archive-session-1',
    })

    expect(parseToolData(result)).toEqual({
      archived: true,
      provider: 'claude_code',
      sessionId: 'archive-session-1',
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

    const result = await callMcpTool(client, 'comment_update', {
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

    const result = await callMcpTool(client, 'comment_update', {
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

    const result = await callMcpTool(client, 'comment_update', {
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

    const result = await callMcpTool(client, 'comment_update', {
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

    const result = await callMcpTool(client, 'comment_update', {
      taskId: task.id,
      commentId: `../../../projects/${project.id}`,
      content: 'Changed project',
    })

    expect(summarizeTraversal(result, await projectTitle(project.id))).toEqual({
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

    const result = await callMcpTool(client, 'comment_list', {
      taskId: task.id,
    })

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

    const result = await callMcpTool(client, 'comment_delete', {
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
    await callMcpTool(client, 'comment_delete', {
      taskId: task.id,
      commentId: comment.id,
    })

    const commentsResponse = await app.request(`/api/tasks/${task.id}/comments`)

    expect(await jsonBody(commentsResponse)).toEqual([])
  })

  it('returns not found for an unknown comment', async () => {
    const task = await createTask('Has comments')

    const result = await callMcpTool(client, 'comment_delete', {
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

    const result = await callMcpTool(client, 'comment_delete', {
      taskId: task.id,
      commentId: `../../../projects/${project.id}`,
    })

    expect(summarizeTraversal(result, await projectTitle(project.id))).toEqual({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Comment not found' }],
      },
      projectTitle: 'Original project',
    })
  })
})

describe('github_unlink tool', () => {
  it('rejects empty and dot link ids before tool execution', async () => {
    const outcomes = await Promise.all(
      ['', '.', '..'].map((linkId) =>
        summarizeToolCallOutcome('github_unlink', {
          taskId: TEST_UUID,
          linkId,
        }),
      ),
    )

    expect(outcomes).toEqual(
      ['', '.', '..'].map((linkId) =>
        expectedPathSegmentValidationError(
          'github_unlink',
          'linkId',
          'GitHub link ID',
          linkId,
        ),
      ),
    )
  })

  it('does not route a traversal link id to a project deletion', async () => {
    const project = await createProject('Original project')
    const task = await createTask('Has GitHub links')

    const result = await callMcpTool(client, 'github_unlink', {
      taskId: task.id,
      linkId: `../../../projects/${project.id}`,
    })

    expect(summarizeTraversal(result, await projectTitle(project.id))).toEqual({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'GitHub link not found' }],
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

    const result = await callMcpTool(client, 'label_update', {
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

    const result = await callMcpTool(client, 'label_update', {
      id: `../projects/${project.id}`,
      name: 'Changed project',
    })

    expect(summarizeTraversal(result, await projectTitle(project.id))).toEqual({
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
    const result = await callMcpTool(client, 'label_delete', { id: label.id })

    expect(parseToolData(result, ['id'])).toEqual({
      deleted: true,
      id: label.id,
    })
  })

  it('removes the label from the label list', async () => {
    const label = await createLabel('label-for-deletion', { context: 'work' })
    await callMcpTool(client, 'label_delete', { id: label.id })

    const response = await app.request('/api/labels?context=work')

    expect(await jsonBody(response)).toEqual([])
  })

  it('does not route a traversal label id to a project deletion', async () => {
    const project = await createProject('Original project')

    const result = await callMcpTool(client, 'label_delete', {
      id: `../projects/${project.id}`,
    })

    expect(summarizeTraversal(result, await projectTitle(project.id))).toEqual({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Label not found' }],
      },
      projectTitle: 'Original project',
    })
  })
})

describe('asset_delete tool', () => {
  it('returns a confirmation after deleting an asset', async () => {
    const asset = await createAsset()
    const result = await callMcpTool(client, 'asset_delete', { id: asset.id })
    const assetResponse = await app.request(`/api/assets/${asset.id}`)

    expect(summarizeAssetDelete(result, assetResponse.status)).toEqual({
      result: { deleted: true, id: asset.id },
      assetStatus: 404,
    })
  })

  it('rejects empty and dot ids before tool execution', async () => {
    const outcomes = await Promise.all(
      ['', '.', '..'].map((id) =>
        summarizeToolCallOutcome('asset_delete', { id }),
      ),
    )

    expect(outcomes).toEqual(
      ['', '.', '..'].map((id) =>
        expectedPathSegmentValidationError(
          'asset_delete',
          'id',
          'Asset ID',
          id,
        ),
      ),
    )
  })

  it('does not route a traversal asset id to a project deletion', async () => {
    const project = await createProject('Original project')

    const result = await callMcpTool(client, 'asset_delete', {
      id: `../projects/${project.id}`,
    })

    expect(summarizeTraversal(result, await projectTitle(project.id))).toEqual({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Asset not found' }],
      },
      projectTitle: 'Original project',
    })
  })
})

describe('operation tool input schemas', () => {
  it('exposes agent only for operations that support attribution', async () => {
    const tools = await client.listTools()
    const server = new McpServer(
      { name: 'test', version: '0.0.0' },
      { capabilities: { tools: {} } },
    )
    const registerTool = vi.spyOn(server, 'registerTool')
    registerOperationTools(server, operations)
    const operationToolNames = registerTool.mock.calls.map(([name]) => name)
    const agentArguments = Object.fromEntries(
      tools.tools
        .filter((tool) => operationToolNames.includes(tool.name))
        .map((tool) => [
          tool.name,
          Object.keys(tool.inputSchema.properties ?? {}).includes('agent'),
        ]),
    )

    expect(agentArguments).toEqual({
      asset_delete: false,
      calendar_events: false,
      checklist_create: true,
      checklist_delete: false,
      checklist_item_add: true,
      checklist_item_check: true,
      checklist_item_delete: false,
      checklist_item_move: true,
      checklist_item_uncheck: true,
      checklist_item_update: true,
      checklist_list: false,
      checklist_update: true,
      comment_create: true,
      comment_delete: false,
      comment_list: false,
      comment_update: true,
      description_template_get: false,
      description_template_list: false,
      github_link: true,
      github_notify: true,
      github_resolve: false,
      github_sync: false,
      github_unlink: true,
      health: false,
      label_delete: false,
      label_list: false,
      label_update: false,
      memo_get: false,
      memo_update: false,
      page_create: true,
      page_delete: false,
      page_get: false,
      page_list: false,
      page_search: false,
      page_update: true,
      project_create: false,
      project_delete: false,
      project_get: false,
      project_list: false,
      project_tasks: false,
      project_update: false,
      task_complete: true,
      task_create: true,
      task_delete: false,
      task_from_github: false,
      queue_get: false,
      queue_list: false,
      queue_set: false,
      saved_view_create: false,
      saved_view_delete: false,
      saved_view_get: false,
      saved_view_list: false,
      saved_view_update: false,
      schedule_override_clear: false,
      schedule_override_set: false,
      schedule_recurring_list: false,
      schedule_time_blocks_create: false,
      schedule_time_blocks_delete: false,
      schedule_time_blocks_list: false,
      schedule_time_blocks_update: false,
      session_archive: false,
      session_delete: false,
      session_list: false,
      task_activity: false,
      task_get: false,
      task_list: false,
      task_parent: false,
      task_search: false,
      task_sessions: false,
      task_status: true,
      task_update: true,
    })
  })
})

describe('operation tool annotations', () => {
  it('maps operation kinds to MCP annotations', async () => {
    const tools = await client.listTools()
    const expectedAnnotations = {
      asset_delete: { readOnlyHint: false, destructiveHint: true },
      calendar_events: { readOnlyHint: true },
      checklist_create: { readOnlyHint: false, destructiveHint: false },
      checklist_delete: { readOnlyHint: false, destructiveHint: true },
      checklist_item_add: { readOnlyHint: false, destructiveHint: false },
      checklist_item_check: { readOnlyHint: false, destructiveHint: false },
      checklist_item_delete: { readOnlyHint: false, destructiveHint: true },
      checklist_item_move: { readOnlyHint: false, destructiveHint: false },
      checklist_item_uncheck: { readOnlyHint: false, destructiveHint: false },
      checklist_item_update: { readOnlyHint: false, destructiveHint: false },
      checklist_list: { readOnlyHint: true },
      checklist_update: { readOnlyHint: false, destructiveHint: false },
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
      description_template_get: { readOnlyHint: true },
      description_template_list: { readOnlyHint: true },
      github_link: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      github_notify: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      github_resolve: { readOnlyHint: true },
      github_sync: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      github_unlink: {
        readOnlyHint: false,
        destructiveHint: true,
      },
      health: { readOnlyHint: true },
      label_delete: {
        readOnlyHint: false,
        destructiveHint: true,
      },
      label_list: { readOnlyHint: true },
      label_update: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      schedule_override_clear: {
        readOnlyHint: false,
        destructiveHint: true,
      },
      schedule_override_set: {
        readOnlyHint: false,
        destructiveHint: false,
      },
      memo_get: { readOnlyHint: true },
      memo_update: { readOnlyHint: false, destructiveHint: false },
    }
    const annotations = Object.fromEntries(
      tools.tools
        .filter((tool) => Object.hasOwn(expectedAnnotations, tool.name))
        .map((tool) => [tool.name, tool.annotations ?? null]),
    )

    expect(annotations).toEqual(expectedAnnotations)
  })
})

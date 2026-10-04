import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { labels, taskDescriptionTemplates } from '#db/schema'
import {
  callMcpTool,
  connectMcpClient,
  normalizeDynamicValues,
  parseToolData,
  parseToolJson,
} from '#routes/mcp/testing'
import { makeDescriptionTemplate } from '#routes/tasks/description-template-test-fixtures'
import { createLabel, createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let client: Client

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sortTaskLabels(value: unknown): unknown {
  if (
    !isRecord(value) ||
    !Array.isArray(value['labels']) ||
    !value['labels'].every(
      (label): label is string => typeof label === 'string',
    )
  ) {
    return value
  }
  return { ...value, labels: [...value['labels']].sort() }
}

function summarizeTaskDeletion(
  result: Awaited<ReturnType<typeof callMcpTool>>,
  lookupStatus: number,
) {
  return { result: parseToolJson(result), lookupStatus }
}

function taskCreateTemplateSnapshot(
  tools: Awaited<ReturnType<Client['listTools']>>['tools'],
) {
  const taskCreate = tools.find((tool) => tool.name === 'task_create')
  if (taskCreate === undefined) return null

  const marker = '\n\nCurrent description templates:'
  const description = taskCreate.description ?? ''
  const guidanceStart = description.indexOf(marker)
  return {
    guidance: guidanceStart === -1 ? null : description.slice(guidanceStart),
    templateSchema: taskCreate.inputSchema.properties?.['template'] ?? null,
  }
}

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('task_create tool', () => {
  it('returns template guidance when an LLM description has an empty section', async () => {
    const guide = 'Describe what success looks like.'
    await db.insert(taskDescriptionTemplates).values(
      makeDescriptionTemplate({
        name: 'mcp-plan',
        whenToUse: 'Use for an MCP-created plan',
        body: '## Goal',
        guide,
      }),
    )

    const result = await callMcpTool(client, 'task_create', {
      title: 'MCP task',
      description: '## Goal\n- [ ]',
      template: 'mcp-plan',
    })

    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text:
            'Empty sections: ## Goal.\n' +
            `Guide:\n${guide}\n` +
            'Fill the sections and retry task creation.',
        },
      ],
    })
  })

  it('exposes the complete task creation input schema', async () => {
    const tools = await client.listTools()
    const taskCreate = tools.tools.find((tool) => tool.name === 'task_create')

    expect(taskCreate?.inputSchema).toEqual({
      type: 'object',
      properties: {
        title: { type: 'string', minLength: 1 },
        description: { type: 'string', maxLength: 100000 },
        template: {
          description:
            'Description template name for LLM-authored tasks. If omitted, the default template is used when configured.',
          type: 'string',
        },
        startDate: { type: 'string' },
        dueDate: { type: 'string' },
        estimatedMinutes: {
          type: 'integer',
          exclusiveMinimum: 0,
          maximum: 9007199254740991,
        },
        parentId: {
          anyOf: [
            {
              type: 'string',
              format: 'uuid',
              pattern:
                '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
            },
            { type: 'string', pattern: '^\\d+$' },
            {
              type: 'integer',
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
            },
          ],
        },
        projectId: {
          type: 'string',
          format: 'uuid',
          pattern:
            '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
        },
        context: { type: 'string', enum: ['work', 'personal'] },
        commitment: {
          type: 'string',
          enum: ['inbox', 'active', 'someday'],
        },
        labels: {
          type: 'array',
          items: { type: 'string', minLength: 1 },
        },
        recurrenceRule: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['daily', 'weekly', 'monthly', 'custom'],
            },
            interval: {
              type: 'integer',
              exclusiveMinimum: 0,
              maximum: 9007199254740991,
            },
            daysOfWeek: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 6 },
            },
            dayOfMonth: {
              type: 'integer',
              minimum: 1,
              maximum: 31,
            },
          },
          required: ['type', 'interval'],
        },
        blockedBy: {
          type: 'array',
          items: {
            anyOf: [
              {
                type: 'string',
                format: 'uuid',
                pattern:
                  '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$',
              },
              { type: 'string', pattern: '^\\d+$' },
              {
                type: 'integer',
                exclusiveMinimum: 0,
                maximum: 9007199254740991,
              },
            ],
          },
        },
        agent: {
          description:
            'Your own model name (e.g. "example-model"), so this write is attributed to you specifically in the edit history. Always pass this when you know it.',
          type: 'string',
          minLength: 1,
          pattern: '^[^\\x00-\\x1f\\x7f]+$',
        },
      },
      required: ['title'],
      $schema: 'https://json-schema.org/draft/2020-12/schema',
    })
  })

  it('does not add guidance when no description templates are configured', async () => {
    const tools = await client.listTools()

    expect(taskCreateTemplateSnapshot(tools.tools)?.guidance ?? null).toEqual(
      null,
    )
  })

  it('lists the current description templates in the task creation tool', async () => {
    await db.insert(taskDescriptionTemplates).values(
      makeDescriptionTemplate({
        name: 'mcp-plan',
        whenToUse: 'Use for planning a project with several deliverables',
        body: '## Goal\n## Steps',
        guide: 'Describe the outcome before listing the steps.',
        isDefault: true,
      }),
    )

    const snapshots = [
      taskCreateTemplateSnapshot((await client.listTools()).tools),
    ]

    await db
      .update(taskDescriptionTemplates)
      .set({
        name: 'mcp-plan-v2',
        whenToUse: 'Use for planning a single milestone',
        body: '## Outcome\n~~~md\n## Not a section\n~~~\n```md\n## Also not a section\n```\n## Validation',
        guide: 'State one measurable outcome.\nExplain how to verify it.',
        isDefault: false,
      })
      .where(eq(taskDescriptionTemplates.name, 'mcp-plan'))
    await db.insert(taskDescriptionTemplates).values(
      makeDescriptionTemplate({
        name: 'mcp-review',
        whenToUse: 'Use for reviewing completed work',
        body: '## Findings\n## Follow-up',
        guide: 'Record findings and the next action.',
        isDefault: true,
      }),
    )

    snapshots.push(taskCreateTemplateSnapshot((await client.listTools()).tools))

    expect(snapshots).toEqual([
      {
        guidance:
          '\n\nCurrent description templates:\n\n' +
          'Choose the template that best fits the task, pass its name in `template`, and fill every listed section with substantive content following its guide.\n\n' +
          '`mcp-plan` (default)\n' +
          'When to use: Use for planning a project with several deliverables\n' +
          'Sections:\n' +
          '- ## Goal\n' +
          '- ## Steps\n' +
          'Guide:\n' +
          'Describe the outcome before listing the steps.',
        templateSchema: {
          type: 'string',
          enum: ['mcp-plan'],
          description:
            'Description template name for LLM-authored tasks. If omitted, the default template is used when configured.',
        },
      },
      {
        guidance:
          '\n\nCurrent description templates:\n\n' +
          'Choose the template that best fits the task, pass its name in `template`, and fill every listed section with substantive content following its guide.\n\n' +
          '`mcp-review` (default)\n' +
          'When to use: Use for reviewing completed work\n' +
          'Sections:\n' +
          '- ## Findings\n' +
          '- ## Follow-up\n' +
          'Guide:\n' +
          'Record findings and the next action.\n\n' +
          '`mcp-plan-v2`\n' +
          'When to use: Use for planning a single milestone\n' +
          'Sections:\n' +
          '- ## Outcome\n' +
          '- ## Validation\n' +
          'Guide:\n' +
          'State one measurable outcome.\n' +
          'Explain how to verify it.',
        templateSchema: {
          type: 'string',
          enum: ['mcp-review', 'mcp-plan-v2'],
          description:
            'Description template name for LLM-authored tasks. If omitted, the default template is used when configured.',
        },
      },
    ])
  })

  it('creates a task with the given fields', async () => {
    const result = await callMcpTool(client, 'task_create', {
      title: 'Write MCP tools',
      context: 'work',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Write MCP tools',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'work',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('creates any label names that do not exist yet and attaches all of them', async () => {
    await db.insert(labels).values({ name: 'urgent' })

    const result = await callMcpTool(client, 'task_create', {
      title: 'Labeled task',
      labels: ['urgent', 'new-label'],
    })

    expect(sortTaskLabels(parseToolData(result))).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Labeled task',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: ['new-label', 'urgent'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent parentId', async () => {
    const result = await callMcpTool(client, 'task_create', {
      title: 'Orphan',
      parentId: TEST_UUID,
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Parent task not found' }],
    })
  })
})

describe('task_update tool', () => {
  it('partially updates the given fields', async () => {
    const task = await createTask('Original title', {
      description: 'Original description',
    })

    const result = await callMcpTool(client, 'task_update', {
      taskId: task.id,
      title: 'Updated title',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Updated title',
      description: 'Original description',
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('clears a nullable field by passing null', async () => {
    const task = await createTask('Has description', {
      description: 'Will be cleared',
    })

    const result = await callMcpTool(client, 'task_update', {
      taskId: task.id,
      description: null,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Has description',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      linkSync: { outgoing: [], unresolvedRefs: [] },
    })
  })

  it('rejects a non-existent taskId', async () => {
    const result = await callMcpTool(client, 'task_update', {
      taskId: TEST_UUID,
      title: 'New title',
    })

    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Task not found' }],
    })
  })

  it('replaces the labels of a task, creating any that do not exist yet', async () => {
    const task = await createTask('Has a label', { labels: ['urgent'] })

    const result = await callMcpTool(client, 'task_update', {
      taskId: task.id,
      labels: ['bug'],
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Has a label',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: ['bug'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })
})

describe('task_complete tool', () => {
  it('sets a task to completed', async () => {
    const task = await createTask('Start me')

    const result = await callMcpTool(client, 'task_complete', {
      taskId: task.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Start me',
      description: null,
      status: 'completed',
      statusReason: 'completed',
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('keeps the labels of a labeled task', async () => {
    await createLabel('urgent')
    const task = await createTask('Start me', { labels: ['urgent'] })

    const result = await callMcpTool(client, 'task_complete', {
      taskId: task.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Start me',
      description: null,
      status: 'completed',
      statusReason: 'completed',
      context: 'personal',
      commitment: 'inbox',
      labels: ['urgent'],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('closes a task as a duplicate and records the target', async () => {
    const target = await createTask('Target')
    const task = await createTask('Duplicate me')

    const result = await callMcpTool(client, 'task_complete', {
      taskId: task.id,
      statusReason: 'duplicate',
      duplicateOfTaskId: target.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Duplicate me',
      description: null,
      status: 'completed',
      statusReason: 'duplicate',
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })

    // The tool response itself carries no duplicateOfNumber/duplicateOfTask
    // field (see TaskResponse) — the detail endpoint is the only way to
    // confirm `duplicateOfTaskId` actually reached the request body.
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<Record<string, unknown>>(detailRes)
    expect(normalizeDynamicValues(detailBody, { taskNumbers: true })).toEqual({
      id: '<uuid>',
      number: -1,
      title: 'Duplicate me',
      description: null,
      status: 'completed',
      statusReason: 'duplicate',
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
      titleAuthor: { kind: 'human', agent: null },
      descriptionAuthor: { kind: 'human', agent: null },
      parentNumber: null,
      childCompletionCount: { total: 0, completed: 0 },
      pages: [],
      timeBlocks: [],
      links: { outgoing: [], incoming: [] },
      duplicateOfNumber: target.number,
      duplicateOfTask: {
        id: '<uuid>',
        number: -1,
        title: 'Target',
        description: null,
        status: 'todo',
        statusReason: null,
        context: 'personal',
        commitment: 'inbox',
        labels: [],
        startDate: null,
        dueDate: null,
        estimatedMinutes: null,
        remindAt: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        templateId: null,
        occurrenceDate: null,
        githubLinks: [],
        createdAt: '<timestamp>',
        updatedAt: '<timestamp>',
        parentNumber: null,
        duplicateOfNumber: null,
        blockedByNumbers: [],
        childCompletionCount: { completed: 0, total: 0 },
      },
      blockedBy: [],
      blocking: [],
    })
  })
})

describe('task_status tool', () => {
  it('reopens a completed task by moving it back to todo', async () => {
    const task = await createTask('Reopen me')
    await callMcpTool(client, 'task_complete', {
      taskId: task.id,
    })

    const result = await callMcpTool(client, 'task_status', {
      taskId: task.id,
      status: 'todo',
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Reopen me',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('rejects completed status because completion has its own tool', async () => {
    const task = await createTask('Reopen me')
    const result = await callMcpTool(client, 'task_status', {
      taskId: task.id,
      status: 'completed',
    })
    const detailResponse = await app.request(`/api/tasks/${task.id}`)
    const detail = await jsonBody<{ status: string }>(detailResponse)

    expect(`${String(result.isError)}:${detail.status}`).toBe('true:todo')
  })
})

describe('task_parent tool', () => {
  it('sets the parent task', async () => {
    const parent = await createTask('Parent task')
    const child = await createTask('Child task')

    const result = await callMcpTool(client, 'task_parent', {
      taskId: child.id,
      parentId: parent.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Child task',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: '<uuid>',
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })

  it('clears the parent when parentId is omitted', async () => {
    const parent = await createTask('Parent task')
    const child = await createTask('Child task')
    await callMcpTool(client, 'task_parent', {
      taskId: child.id,
      parentId: parent.id,
    })

    const result = await callMcpTool(client, 'task_parent', {
      taskId: child.id,
    })

    expect(parseToolData(result)).toEqual({
      id: '<uuid>',
      number: '<number>',
      title: 'Child task',
      description: null,
      status: 'todo',
      statusReason: null,
      context: 'personal',
      commitment: 'inbox',
      labels: [],
      startDate: null,
      dueDate: null,
      estimatedMinutes: null,
      remindAt: null,
      parentId: null,
      projectId: null,
      recurrenceRuleId: null,
      recurrenceRule: null,
      templateId: null,
      occurrenceDate: null,
      githubLinks: [],
      createdAt: '<timestamp>',
      updatedAt: '<timestamp>',
    })
  })
})

describe('task_delete tool', () => {
  it('deletes the task and returns its id', async () => {
    const task = await createTask('Delete me')

    const result = await callMcpTool(client, 'task_delete', {
      taskId: task.id,
    })
    const lookup = await app.request(`/api/tasks/${task.id}`)

    expect(summarizeTaskDeletion(result, lookup.status)).toEqual({
      result: { deleted: true, id: task.id },
      lookupStatus: 404,
    })
  })
})

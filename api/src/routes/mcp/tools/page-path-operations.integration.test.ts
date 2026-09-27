import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { app } from '#app'
import { callMcpTool, connectMcpClient } from '#routes/mcp/testing'
import { createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

function expectedPageIdValidationError(name: string, pageId: string) {
  const issue =
    pageId === ''
      ? 'Too small: expected string to have >=1 characters'
      : 'Page ID must be a valid path segment'

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: `Input validation error: Invalid arguments for tool ${name}: pageId: ${issue}`,
      },
    ],
  }
}

async function createProject(title: string) {
  const response = await app.request('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })

  return jsonBody(response, z.object({ id: z.uuid() }))
}

function summarizeTraversal(
  result: unknown,
  projectStatus: number,
  projectBody: unknown,
) {
  return {
    result,
    project: { status: projectStatus, body: projectBody },
  }
}

let client: Client

beforeEach(async () => {
  client = await connectMcpClient()
})

afterEach(async () => {
  await client.close()
})

describe('page path operations', () => {
  it('rejects empty and dot page ids before tool execution', async () => {
    const toolNames = ['page_get', 'page_update', 'page_delete']
    const invalidPageIds = ['', '.', '..', '\uD800']
    const outcomes = await Promise.all(
      toolNames.flatMap((name) =>
        invalidPageIds.map((pageId) =>
          callMcpTool(
            client,
            name,
            name === 'page_update'
              ? { taskId: TEST_UUID, pageId, title: 'Updated page' }
              : { taskId: TEST_UUID, pageId },
          ),
        ),
      ),
    )

    expect(outcomes).toEqual(
      toolNames.flatMap((name) =>
        invalidPageIds.map((pageId) =>
          expectedPageIdValidationError(name, pageId),
        ),
      ),
    )
  })

  it('does not route a traversal page id to a project deletion', async () => {
    const project = await createProject('Protected project')
    const task = await createTask('Has pages')

    const result = await callMcpTool(client, 'page_delete', {
      taskId: task.id,
      pageId: `../../../projects/${project.id}`,
    })
    const projectResponse = await app.request(`/api/projects/${project.id}`)
    const projectBody = await jsonBody(
      projectResponse,
      z.union([
        z.object({ title: z.string() }),
        z.object({ error: z.string() }),
      ]),
    )

    expect(
      summarizeTraversal(result, projectResponse.status, projectBody),
    ).toEqual({
      result: {
        isError: true,
        content: [{ type: 'text', text: 'Page not found' }],
      },
      project: { status: 200, body: { title: 'Protected project' } },
    })
  })
})

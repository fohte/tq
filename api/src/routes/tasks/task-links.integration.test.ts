import { describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  callMcpTool,
  connectMcpClient,
  parseToolJson,
} from '#routes/mcp/testing'
import {
  createComment,
  createPage,
  createRecurringTask,
  createTask,
  type LinkedTaskResponse,
  type TaskResponse,
} from '#routes/tasks/testing'
import {
  assertDefined,
  jsonBody,
  passthroughSchema,
  setupTestDb,
} from '#testing'

setupTestDb()

function linkSummary(
  task: Pick<TaskResponse, 'id' | 'number' | 'title' | 'status'>,
): LinkedTaskResponse {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    status: task.status,
  }
}

async function patchTask(id: string, body: Record<string, unknown>) {
  const res = await app.request(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return jsonBody<TaskResponse>(res)
}

async function patchPage(
  taskId: string,
  pageId: string,
  body: Record<string, unknown>,
) {
  const res = await app.request(`/api/tasks/${taskId}/pages/${pageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(200)
}

async function patchComment(
  taskId: string,
  commentId: string,
  body: Record<string, unknown>,
) {
  const res = await app.request(`/api/tasks/${taskId}/comments/${commentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(200)
}

async function getLinks(id: string) {
  const res = await app.request(`/api/tasks/${id}`)
  expect(res.status).toBe(200)
  const body = await jsonBody<TaskResponse>(res)
  return body.links
}

describe('task mention links', () => {
  it('links from a mention in the description', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await patchTask(source.id, { description: `See #${String(target.number)}` })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('makes the source visible as an incoming link on the target task', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await patchTask(source.id, { description: `See #${String(target.number)}` })

    expect(await getLinks(target.id)).toEqual({
      outgoing: [],
      incoming: [linkSummary(source)],
    })
  })

  it('links from a mention in a page', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await createPage(source.id, 'Notes', `Related to #${String(target.number)}`)

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('does not link from a mention in an html-format page', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await createPage(
      source.id,
      'Notes',
      `Related to #${String(target.number)}`,
      { format: 'html' },
    )

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('does not link from a numeric character reference in an html-format page', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await createPage(
      source.id,
      'Notes',
      `<p>See &#${String(target.number)};</p>`,
      { format: 'html' },
    )

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('links from a mention in a comment', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await createComment(source.id, `cc #${String(target.number)}`)

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('removes the link once the mention is edited out of the description', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: `See #${String(target.number)}` })

    await patchTask(source.id, { description: 'No longer mentions anyone' })

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('removes the link once the mentioning page is deleted', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    const page = await createPage(
      source.id,
      'Notes',
      `Related to #${String(target.number)}`,
    )

    const res = await app.request(`/api/tasks/${source.id}/pages/${page.id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('removes the link once the mentioning comment is deleted', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    const comment = await createComment(
      source.id,
      `cc #${String(target.number)}`,
    )

    const res = await app.request(
      `/api/tasks/${source.id}/comments/${comment.id}`,
      { method: 'DELETE' },
    )
    expect(res.status).toBe(204)

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('ignores a mention of the task itself', async () => {
    const source = await createTask('Source')

    await patchTask(source.id, {
      description: `Self reference #${String(source.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('ignores a mention of a task number that does not exist', async () => {
    const source = await createTask('Source')

    await patchTask(source.id, { description: 'See #999999999' })

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('collapses repeated mentions of the same task into a single link', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await patchTask(source.id, {
      description: `#${String(target.number)} again, see #${String(target.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('orders outgoing links by task number regardless of mention order', async () => {
    // Created in this order, so `lowerNumber.number < higherNumber.number`.
    const lowerNumber = await createTask('Lower number')
    const higherNumber = await createTask('Higher number')
    const source = await createTask('Source')
    await patchTask(source.id, {
      description: `See #${String(higherNumber.number)} and #${String(lowerNumber.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(lowerNumber), linkSummary(higherNumber)],
      incoming: [],
    })
  })

  it('keeps the link while the mention still exists in another field', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: `See #${String(target.number)}` })
    await createPage(source.id, 'Notes', `Also #${String(target.number)}`)

    await patchTask(source.id, { description: 'No longer mentions anyone' })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('removes the link once the mention is gone from every field', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: `See #${String(target.number)}` })
    const page = await createPage(
      source.id,
      'Notes',
      `Also #${String(target.number)}`,
    )
    await patchTask(source.id, { description: 'No longer mentions anyone' })

    await patchPage(source.id, page.id, { content: 'Not anymore either' })

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('reflects edits to a comment mention', async () => {
    const source = await createTask('Source')
    const targetA = await createTask('Target A')
    const targetB = await createTask('Target B')
    const comment = await createComment(
      source.id,
      `cc #${String(targetA.number)}`,
    )

    await patchComment(source.id, comment.id, {
      content: `cc #${String(targetB.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(targetB)],
      incoming: [],
    })
  })

  it('removes both outgoing and incoming links when the source task is deleted', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: `See #${String(target.number)}` })

    const res = await app.request(`/api/tasks/${source.id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)

    expect(await getLinks(target.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('removes both outgoing and incoming links when the target task is deleted', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: `See #${String(target.number)}` })

    const res = await app.request(`/api/tasks/${target.id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)

    expect(await getLinks(source.id)).toEqual({ outgoing: [], incoming: [] })
  })

  it('links a task created with a mention already in its description', async () => {
    const target = await createTask('Target')

    const source = await createTask('Source', {
      description: `See #${String(target.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('links the next occurrence generated when a recurring task completes', async () => {
    const target = await createTask('Target')
    const source = await createRecurringTask(
      'Recurring source',
      { type: 'daily', interval: 1 },
      { dueDate: '2026-03-22', description: `See #${String(target.number)}` },
    )

    const res = await app.request(`/api/tasks/${source.id}/complete`, {
      method: 'POST',
    })
    expect(res.status).toBe(200)
    const body = await jsonBody<
      TaskResponse & { nextTask: TaskResponse | null }
    >(res)
    assertDefined(body.nextTask)

    expect(await getLinks(body.nextTask.id)).toEqual({
      outgoing: [linkSummary(target)],
      incoming: [],
    })
  })

  it('is visible through the MCP get_task tool, matching REST', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: `See #${String(target.number)}` })

    const client = await connectMcpClient()
    try {
      const result = await callMcpTool(client, 'get_task', {
        taskId: source.id,
      })
      const data = passthroughSchema<TaskResponse>().parse(
        parseToolJson(result),
      )

      expect(data.links).toEqual({
        outgoing: [linkSummary(target)],
        incoming: [],
      })
    } finally {
      await client.close()
    }
  })
})

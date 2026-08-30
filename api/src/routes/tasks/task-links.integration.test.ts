import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { APP_DOMAIN } from '#env'
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
  type LinkSyncResponse,
  type TaskListItemResponse,
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

// `getLinks` (the task-detail `links` field) renders the same row appearance
// as every other task list, so it returns the full list-item shape. None of
// the tasks linked in these tests have a parent or children of their own.
function linkedTaskDetail(
  task: Pick<
    TaskResponse,
    | 'id'
    | 'number'
    | 'title'
    | 'description'
    | 'status'
    | 'context'
    | 'commitment'
    | 'labels'
    | 'startDate'
    | 'dueDate'
    | 'estimatedMinutes'
    | 'parentId'
    | 'projectId'
    | 'recurrenceRuleId'
    | 'githubLinks'
    | 'createdAt'
    | 'updatedAt'
  >,
  childCompletionCount: { completed: number; total: number } = {
    completed: 0,
    total: 0,
  },
): TaskListItemResponse {
  return {
    id: task.id,
    number: task.number,
    title: task.title,
    description: task.description,
    status: task.status,
    context: task.context,
    commitment: task.commitment,
    labels: task.labels,
    startDate: task.startDate,
    dueDate: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
    parentId: task.parentId,
    projectId: task.projectId,
    recurrenceRuleId: task.recurrenceRuleId,
    githubLinks: task.githubLinks,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    parentNumber: null,
    childCompletionCount,
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
      outgoing: [linkedTaskDetail(target)],
      incoming: [],
    })
  })

  it("reflects a linked task's own labels and child-completion count", async () => {
    const source = await createTask('Source')
    const target = await createTask('Target', { labels: ['foo'] })
    await createTask('Child', { parentId: target.id })

    await patchTask(source.id, { description: `See #${String(target.number)}` })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkedTaskDetail(target, { completed: 0, total: 1 })],
      incoming: [],
    })
  })

  it('links from a numeric task URL in the description', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await patchTask(source.id, {
      description: `See https://${APP_DOMAIN}/tasks/${String(target.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkedTaskDetail(target)],
      incoming: [],
    })
  })

  it('links from a uuid task URL in the description', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await patchTask(source.id, {
      description: `See https://${APP_DOMAIN}/tasks/${target.id}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkedTaskDetail(target)],
      incoming: [],
    })
  })

  it('collapses a task URL and a `#N` mention of the same task into a single link', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await patchTask(source.id, {
      description: `#${String(target.number)} and https://${APP_DOMAIN}/tasks/${String(target.number)}`,
    })

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkedTaskDetail(target)],
      incoming: [],
    })
  })

  it('makes the source visible as an incoming link on the target task', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    const updatedSource = await patchTask(source.id, {
      description: `See #${String(target.number)}`,
    })

    expect(await getLinks(target.id)).toEqual({
      outgoing: [],
      incoming: [linkedTaskDetail(updatedSource)],
    })
  })

  it('links from a mention in a page', async () => {
    const source = await createTask('Source')
    const target = await createTask('Target')

    await createPage(source.id, 'Notes', `Related to #${String(target.number)}`)

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkedTaskDetail(target)],
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
      outgoing: [linkedTaskDetail(target)],
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
      outgoing: [linkedTaskDetail(target)],
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
      outgoing: [linkedTaskDetail(lowerNumber), linkedTaskDetail(higherNumber)],
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
      outgoing: [linkedTaskDetail(target)],
      incoming: [],
    })
  })

  it('does not let an unterminated backtick in one field mask a mention in the next field as code', async () => {
    // Each field is parsed on its own rather than joined into one string
    // first: an unmatched backtick ending the description would otherwise
    // pair up with the closing backtick in the page below, turning the page's
    // mention into the content of one inline code span spanning both fields
    // and masking it out.
    const source = await createTask('Source')
    const target = await createTask('Target')
    await patchTask(source.id, { description: 'see `' })
    await createPage(
      source.id,
      'Notes',
      `code #${String(target.number)} more\``,
    )

    expect(await getLinks(source.id)).toEqual({
      outgoing: [linkedTaskDetail(target)],
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
      outgoing: [linkedTaskDetail(targetB)],
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
      outgoing: [linkedTaskDetail(target)],
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
      outgoing: [linkedTaskDetail(target)],
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
        outgoing: [linkedTaskDetail(target)],
        incoming: [],
      })
    } finally {
      await client.close()
    }
  })
})

describe('linkSync on write responses', () => {
  it('reports resolved and unresolved refs in the PATCH response', async () => {
    const target = await createTask('Target')
    const source = await createTask('Source')

    const body = await patchTask(source.id, {
      description: `See #${String(target.number)} and #999999999`,
    })

    expect(body.linkSync).toEqual({
      outgoing: [linkSummary(target)],
      unresolvedRefs: [
        {
          kind: 'number',
          value: 999999999,
          sources: [{ kind: 'description' }],
        },
      ],
    })
  })

  it('reports the page as the source of an unresolved ref found in a page', async () => {
    const source = await createTask('Source')

    const res = await app.request(`/api/tasks/${source.id}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Notes', content: 'See #999999999' }),
    })
    expect(res.status).toBe(201)
    const body = await jsonBody<{ id: string; linkSync: LinkSyncResponse }>(res)

    expect(body.linkSync).toEqual({
      outgoing: [],
      unresolvedRefs: [
        {
          kind: 'number',
          value: 999999999,
          sources: [{ kind: 'page', id: body.id, title: 'Notes' }],
        },
      ],
    })
  })

  it('reports every field an unresolved ref appears in', async () => {
    const source = await createTask('Source')
    const page = await createPage(source.id, 'Notes', 'See #999999999')

    const body = await patchTask(source.id, {
      description: 'Also #999999999',
    })

    expect(body.linkSync).toEqual({
      outgoing: [],
      unresolvedRefs: [
        {
          kind: 'number',
          value: 999999999,
          sources: [
            { kind: 'description' },
            { kind: 'page', id: page.id, title: 'Notes' },
          ],
        },
      ],
    })
  })

  it('includes the resolved link in a comment creation response', async () => {
    const target = await createTask('Target')
    const source = await createTask('Source')

    const res = await app.request(`/api/tasks/${source.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `cc #${String(target.number)}` }),
    })
    expect(res.status).toBe(201)
    const body = await jsonBody<{ linkSync: LinkSyncResponse }>(res)

    expect(body.linkSync).toEqual({
      outgoing: [linkSummary(target)],
      unresolvedRefs: [],
    })
  })

  it('omits linkSync from the PATCH response when the patch does not touch description', async () => {
    const source = await createTask('Source')

    const body = await patchTask(source.id, { title: 'New title' })

    expect('linkSync' in body).toBe(false)
  })

  it('omits linkSync from a page PATCH response when the patch does not touch content', async () => {
    const source = await createTask('Source')
    const page = await createPage(source.id, 'Notes', 'Body')

    const res = await app.request(`/api/tasks/${source.id}/pages/${page.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New title' }),
    })
    expect(res.status).toBe(200)
    const body = await jsonBody<Record<string, unknown>>(res)

    expect('linkSync' in body).toBe(false)
  })
})

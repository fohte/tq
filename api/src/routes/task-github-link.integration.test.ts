import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { oauthTokens } from '#db/schema'
import type { GithubLinkResponse, TaskResponse } from '#routes/tasks/testing'
import { createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

async function upsertToken(accessToken: string) {
  await db
    .insert(oauthTokens)
    .values({ provider: 'github', accessToken })
    .onConflictDoUpdate({
      target: oauthTokens.provider,
      set: { accessToken, updatedAt: new Date() },
    })
}

function mockIssueResponse(overrides: Partial<Record<string, unknown>> = {}) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
        html_url: 'https://github.com/fohte/tq/issues/42',
        ...overrides,
      }),
      { status: 200 },
    ),
  )
}

function normalizeLink(link: GithubLinkResponse) {
  return { ...link, id: 'ID', lastSyncedAt: 'DATE' }
}

describe('POST /api/tasks/:taskId/github-link', () => {
  it('links an existing task to a GitHub issue', async () => {
    const task = await createTask('My task')
    await upsertToken('valid-token')
    mockIssueResponse()

    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    expect(res.status).toBe(201)
    const body = await jsonBody<GithubLinkResponse>(res)
    expect(normalizeLink(body)).toEqual({
      id: 'ID',
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Bug: something broke',
      lastSyncedAt: 'DATE',
    })
  })

  it('returns 400 for a non-GitHub URL', async () => {
    const task = await createTask('My task')

    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com/not-github' }),
    })

    expect(res.status).toBe(400)
  })

  it('returns 404 for a non-existent task', async () => {
    const res = await app.request(`/api/tasks/${TEST_UUID}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 409 when the task is already linked', async () => {
    const task = await createTask('My task')
    await upsertToken('valid-token')
    mockIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    mockIssueResponse({ html_url: 'https://github.com/fohte/tq/issues/43' })
    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/43' }),
    })

    expect(res.status).toBe(409)
  })

  it('returns 409 with the linked task id when the issue is linked to another task', async () => {
    const linkedTask = await createTask('Already linked')
    await upsertToken('valid-token')
    mockIssueResponse()
    await app.request(`/api/tasks/${linkedTask.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    const otherTask = await createTask('Another task')
    const res = await app.request(`/api/tasks/${otherTask.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    expect(res.status).toBe(409)
    const body = await jsonBody<{ error: string; linkedTaskId: string }>(res)
    expect(body.linkedTaskId).toBe(linkedTask.id)
  })
})

describe('DELETE /api/tasks/:taskId/github-link', () => {
  it('removes the link, leaving the task intact', async () => {
    const task = await createTask('My task')
    await upsertToken('valid-token')
    mockIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLink).toBeNull()
  })

  it('returns 404 when the task has no link', async () => {
    const task = await createTask('My task')

    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
  })
})

describe('githubLink embedded in task responses', () => {
  it('is null for a task with no link', async () => {
    const task = await createTask('My task')

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLink).toBeNull()

    const listRes = await app.request('/api/tasks')
    const listBody = await jsonBody<TaskResponse[]>(listRes)
    expect(listBody.find((t) => t.id === task.id)?.githubLink).toBeNull()
  })

  it('appears in both the detail and list responses once linked', async () => {
    const task = await createTask('My task')
    await upsertToken('valid-token')
    mockIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLink?.url).toBe(
      'https://github.com/fohte/tq/issues/42',
    )

    const listRes = await app.request('/api/tasks')
    const listBody = await jsonBody<TaskResponse[]>(listRes)
    expect(listBody.find((t) => t.id === task.id)?.githubLink?.url).toBe(
      'https://github.com/fohte/tq/issues/42',
    )
  })
})

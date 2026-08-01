import { asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskEvents } from '#db/schema'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import type { GithubLinkResponse, TaskResponse } from '#routes/tasks/testing'
import { createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

function normalizeLink(link: GithubLinkResponse) {
  return { ...link, id: 'ID', lastSyncedAt: 'DATE' }
}

interface TaskEventFields {
  type: 'status_changed' | 'github_linked' | 'github_unlinked'
  githubOwner: string | null
  githubRepo: string | null
  githubNumber: number | null
  githubKind: 'issue' | 'pull_request' | null
  authorKind: 'human' | 'llm' | 'system'
  authorAgent: string | null
}

async function fetchTaskEvents(taskId: string): Promise<TaskEventFields[]> {
  const rows = await db
    .select()
    .from(taskEvents)
    .where(eq(taskEvents.taskId, taskId))
    .orderBy(asc(taskEvents.id))
  return rows.map((row) => ({
    type: row.type,
    githubOwner: row.githubOwner,
    githubRepo: row.githubRepo,
    githubNumber: row.githubNumber,
    githubKind: row.githubKind,
    authorKind: row.authorKind,
    authorAgent: row.authorAgent,
  }))
}

describe('POST /api/tasks/:taskId/github-link', () => {
  it('links an existing task to a GitHub issue', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

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

  it('records a github_linked task_event', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    expect(await fetchTaskEvents(task.id)).toEqual([
      {
        type: 'github_linked',
        githubOwner: 'fohte',
        githubRepo: 'tq',
        githubNumber: 42,
        githubKind: 'issue',
        authorKind: 'human',
        authorAgent: null,
      },
    ])
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
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    mockGithubIssueResponse({
      html_url: 'https://github.com/fohte/tq/issues/43',
    })
    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/43' }),
    })

    expect(res.status).toBe(409)
  })

  it('returns 409 with the linked task id when the issue is linked to another task', async () => {
    const linkedTask = await createTask('Already linked')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
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
    expect(await res.json()).toEqual({
      error:
        'This GitHub issue or pull request is already linked to another task',
      linkedTaskId: linkedTask.id,
    })
  })
})

describe('DELETE /api/tasks/:taskId/github-link', () => {
  it('removes the link, leaving the task intact', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
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

  it('records a github_unlinked task_event with the removed link', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })

    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'DELETE',
    })

    expect(await fetchTaskEvents(task.id)).toEqual([
      {
        type: 'github_linked',
        githubOwner: 'fohte',
        githubRepo: 'tq',
        githubNumber: 42,
        githubKind: 'issue',
        authorKind: 'human',
        authorAgent: null,
      },
      {
        type: 'github_unlinked',
        githubOwner: 'fohte',
        githubRepo: 'tq',
        githubNumber: 42,
        githubKind: 'issue',
        authorKind: 'human',
        authorAgent: null,
      },
    ])
  })
})

describe('POST /api/tasks/:taskId/github-link/sync', () => {
  it('refreshes the linked task from GitHub', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    // Consume the link's first sync (seed-only, see syncLinkFromGithub).
    mockGithubIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    mockGithubIssueResponse({ title: 'Renamed on GitHub' })
    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(204)
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.title).toBe('Renamed on GitHub')
  })

  it('is a no-op when the task has no link', async () => {
    const task = await createTask('My task')

    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(204)
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
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const link = await jsonBody<GithubLinkResponse>(linkRes)

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLink).toEqual(link)

    const listRes = await app.request('/api/tasks')
    const listBody = await jsonBody<TaskResponse[]>(listRes)
    expect(listBody.find((t) => t.id === task.id)?.githubLink).toEqual(link)
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import type {
  GithubLinkResponse,
  TaskListItemResponse,
  TaskResponse,
} from '#routes/tasks/testing'
import { createTask, fetchTaskEvents, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

function normalizeLink(link: GithubLinkResponse) {
  return { ...link, id: 'ID', lastSyncedAt: 'DATE' }
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
        fromStatus: null,
        toStatus: null,
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

  it('accepts the task number in place of the UUID', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const res = await app.request(
      `/api/tasks/${String(task.number)}/github-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: 'https://github.com/fohte/tq/issues/42',
        }),
      },
    )

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

  it('allows linking a second, different issue to an already-linked task', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const firstRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const firstLink = await jsonBody<GithubLinkResponse>(firstRes)

    mockGithubIssueResponse({
      html_url: 'https://github.com/fohte/tq/issues/43',
    })
    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/43' }),
    })

    expect(res.status).toBe(201)
    const secondLink = await jsonBody<GithubLinkResponse>(res)

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLinks).toEqual([firstLink, secondLink])
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

describe('DELETE /api/tasks/:taskId/github-link/:linkId', () => {
  it('removes the link, leaving the task intact', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const link = await jsonBody<GithubLinkResponse>(linkRes)

    const res = await app.request(
      `/api/tasks/${task.id}/github-link/${link.id}`,
      { method: 'DELETE' },
    )

    expect(res.status).toBe(204)

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLinks).toEqual([])
  })

  it('returns 404 when the task has no link', async () => {
    const task = await createTask('My task')

    const res = await app.request(
      `/api/tasks/${task.id}/github-link/${TEST_UUID}`,
      { method: 'DELETE' },
    )

    expect(res.status).toBe(404)
  })

  it('records a github_unlinked task_event with the removed link', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const link = await jsonBody<GithubLinkResponse>(linkRes)

    await app.request(`/api/tasks/${task.id}/github-link/${link.id}`, {
      method: 'DELETE',
    })

    expect(await fetchTaskEvents(task.id)).toEqual([
      {
        type: 'github_linked',
        fromStatus: null,
        toStatus: null,
        githubOwner: 'fohte',
        githubRepo: 'tq',
        githubNumber: 42,
        githubKind: 'issue',
        authorKind: 'human',
        authorAgent: null,
      },
      {
        type: 'github_unlinked',
        fromStatus: null,
        toStatus: null,
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

  it('syncs every linked issue, not just the first', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const firstLinkRes = await app.request(
      `/api/tasks/${task.id}/github-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
      },
    )
    const firstLink = await jsonBody<GithubLinkResponse>(firstLinkRes)

    mockGithubIssueResponse({
      html_url: 'https://github.com/fohte/tq/issues/43',
    })
    const secondLinkRes = await app.request(
      `/api/tasks/${task.id}/github-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/43' }),
      },
    )
    const secondLink = await jsonBody<GithubLinkResponse>(secondLinkRes)

    // Consume both links' first sync (seed-only, see syncLinkFromGithub).
    mockGithubIssueResponse()
    mockGithubIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    mockGithubIssueResponse({ title: 'Synced' })
    mockGithubIssueResponse({ title: 'Synced' })
    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(204)
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLinks.map(normalizeLink)).toEqual(
      [firstLink, secondLink].map((link) => ({
        ...normalizeLink(link),
        title: 'Synced',
      })),
    )
  })

  it('continues syncing the other link when one link fails to fetch from GitHub', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const firstLinkRes = await app.request(
      `/api/tasks/${task.id}/github-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
      },
    )
    const firstLink = await jsonBody<GithubLinkResponse>(firstLinkRes)

    mockGithubIssueResponse({
      html_url: 'https://github.com/fohte/tq/issues/43',
    })
    const secondLinkRes = await app.request(
      `/api/tasks/${task.id}/github-link`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/43' }),
      },
    )
    const secondLink = await jsonBody<GithubLinkResponse>(secondLinkRes)

    // Consume both links' first sync (seed-only, see syncLinkFromGithub).
    mockGithubIssueResponse()
    mockGithubIssueResponse()
    await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    // firstLink's fetch fails; secondLink's still succeeds.
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('boom', { status: 500 }),
    )
    mockGithubIssueResponse({ title: 'Synced' })
    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(204)
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLinks.map(normalizeLink)).toEqual([
      normalizeLink(firstLink),
      { ...normalizeLink(secondLink), title: 'Synced' },
    ])
  })

  it('is a no-op when the task has no link', async () => {
    const task = await createTask('My task')

    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(204)
  })

  it('returns 404 for a non-existent task', async () => {
    const res = await app.request(`/api/tasks/${TEST_UUID}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(404)
  })
})

describe('githubLinks embedded in task responses', () => {
  it('is an empty array for a task with no link', async () => {
    const task = await createTask('My task')

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLinks).toEqual([])

    const listRes = await app.request('/api/tasks')
    const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
    expect(listBody.find((t) => t.id === task.id)?.githubLinks).toEqual([])

    const searchRes = await app.request(
      '/api/tasks?q=' + encodeURIComponent('My task'),
    )
    const searchBody = await jsonBody<TaskListItemResponse[]>(searchRes)
    expect(searchBody.find((t) => t.id === task.id)?.githubLinks).toEqual([])
  })

  it('appears in the detail, list, and search responses once linked', async () => {
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
    expect(detailBody.githubLinks).toEqual([link])

    const listRes = await app.request('/api/tasks')
    const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
    expect(listBody.find((t) => t.id === task.id)?.githubLinks).toEqual([link])

    const searchRes = await app.request(
      '/api/tasks?q=' + encodeURIComponent('My task'),
    )
    const searchBody = await jsonBody<TaskListItemResponse[]>(searchRes)
    expect(searchBody.find((t) => t.id === task.id)?.githubLinks).toEqual([
      link,
    ])
  })

  it('contains both links, in creation order, once a second issue is linked', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const firstRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const firstLink = await jsonBody<GithubLinkResponse>(firstRes)

    mockGithubIssueResponse({
      html_url: 'https://github.com/fohte/tq/issues/43',
    })
    const secondRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/43' }),
    })
    const secondLink = await jsonBody<GithubLinkResponse>(secondRes)

    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.githubLinks).toEqual([firstLink, secondLink])

    const listRes = await app.request('/api/tasks')
    const listBody = await jsonBody<TaskListItemResponse[]>(listRes)
    expect(listBody.find((t) => t.id === task.id)?.githubLinks).toEqual([
      firstLink,
      secondLink,
    ])

    const searchRes = await app.request(
      '/api/tasks?q=' + encodeURIComponent('My task'),
    )
    const searchBody = await jsonBody<TaskListItemResponse[]>(searchRes)
    expect(searchBody.find((t) => t.id === task.id)?.githubLinks).toEqual([
      firstLink,
      secondLink,
    ])
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import type { GithubLinkResponse, TaskResponse } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

function normalizeLink(link: GithubLinkResponse) {
  return { ...link, id: 'ID', lastSyncedAt: 'DATE' }
}

async function resolve(url: string) {
  return app.request('/api/github/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

describe('POST /api/github/resolve', () => {
  it('returns a preview when the issue is not linked to any task', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      linked: false,
      preview: {
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
        url: 'https://github.com/fohte/tq/issues/42',
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
      },
    })
  })

  it('returns the existing task when already linked', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const created = await app.request('/api/tasks/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const createdBody = await jsonBody<{ task: TaskResponse }>(created)

    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    const body = await jsonBody<{ linked: boolean; task: TaskResponse }>(res)
    expect(body).toEqual({ linked: true, task: createdBody.task })
  })

  it('returns 400 for a non-GitHub URL', async () => {
    const res = await resolve('https://example.com/not-github')

    expect(res.status).toBe(400)
  })

  it('returns 400 when GitHub is not connected', async () => {
    const res = await resolve('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(400)
  })
})

describe('GET /api/github/link', () => {
  async function link(url: string) {
    return app.request(`/api/github/link?url=${encodeURIComponent(url)}`)
  }

  it('returns task: null for an unlinked URL, without calling the GitHub API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    const res = await link('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ task: null })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns the linked task without calling the GitHub API', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const created = await app.request('/api/tasks/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const createdBody = await jsonBody<{ task: TaskResponse }>(created)
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockClear()

    const res = await link('https://github.com/fohte/tq/issues/42')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ task: createdBody.task })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 400 for a non-GitHub URL', async () => {
    const res = await link('https://example.com/not-github')

    expect(res.status).toBe(400)
  })

  it('returns 400 when the url query param is missing', async () => {
    const res = await app.request('/api/github/link')

    expect(res.status).toBe(400)
  })
})

describe('POST /api/github/sync', () => {
  it('syncs every linked task', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const created = await app.request('/api/tasks/from-github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const { task } = await jsonBody<{ task: TaskResponse }>(created)

    mockGithubIssueResponse({ title: 'Renamed on GitHub' })
    const res = await app.request('/api/github/sync', { method: 'POST' })

    expect(res.status).toBe(204)
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.title).toBe(task.title)
    expect(detailBody.githubLinks.map(normalizeLink)).toEqual(
      task.githubLinks.map((link) => ({
        ...normalizeLink(link),
        title: 'Renamed on GitHub',
      })),
    )
  })

  it('returns 204 without error when GitHub is not connected', async () => {
    const res = await app.request('/api/github/sync', { method: 'POST' })

    expect(res.status).toBe(204)
  })
})

import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { defaultGithubNotifyEvents, taskGithubLinks } from '#db/schema'
import {
  mockGithubActivityRoutes,
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import type {
  GithubLinkResponse,
  TaskListItemResponse,
  TaskResponse,
} from '#routes/tasks/testing'
import { createTask, fetchTaskEvents, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  vi.restoreAllMocks()
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
})

function normalizeLink(link: GithubLinkResponse) {
  return { ...link, id: 'ID', lastSyncedAt: 'DATE' }
}

function normalizeGithubLinkResult(status: number, link: GithubLinkResponse) {
  return { status, link: normalizeLink(link) }
}

function normalizeGithubLinkUpdateResult(
  status: number,
  response: GithubLinkResponse,
  stored: GithubLinkResponse[],
) {
  return {
    status,
    response: normalizeLink(response),
    stored: stored.map(normalizeLink),
  }
}

function normalizeGithubLinkErrorResult(status: number, body: unknown) {
  return { status, body }
}

const exampleGithubIssueUrl =
  'https://github.com/example-owner/example-repo/issues/7319'

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
      role: 'subject',
      notifyEvents: ['closed', 'reopened', 'comments', 'other'],
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Bug: something broke',
      lastSyncedAt: 'DATE',
    })
  })

  it('uses the requested notify events when linking', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({
      title: 'An example issue',
      html_url: exampleGithubIssueUrl,
    })

    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: exampleGithubIssueUrl,
        notifyEvents: ['comments'],
      }),
    })

    expect(
      normalizeGithubLinkResult(
        res.status,
        await jsonBody<GithubLinkResponse>(res),
      ),
    ).toEqual({
      status: 201,
      link: {
        id: 'ID',
        owner: 'example-owner',
        repo: 'example-repo',
        number: 7319,
        kind: 'issue',
        role: 'subject',
        notifyEvents: ['comments'],
        url: exampleGithubIssueUrl,
        state: 'open',
        title: 'An example issue',
        lastSyncedAt: 'DATE',
      },
    })
  })

  it('rejects unknown notify events when linking', async () => {
    const task = await createTask('My task')

    const res = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: exampleGithubIssueUrl,
        notifyEvents: ['unknown'],
      }),
    })

    expect(res.status).toEqual(400)
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
        toStatusReason: null,
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
      role: 'subject',
      notifyEvents: ['closed', 'reopened', 'comments', 'other'],
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

describe('PATCH /api/tasks/:taskId/github-link/:linkId', () => {
  it('updates and persists the notify events', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({
      title: 'An example issue',
      html_url: exampleGithubIssueUrl,
    })
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: exampleGithubIssueUrl }),
    })
    const link = await jsonBody<GithubLinkResponse>(linkRes)

    const res = await app.request(
      `/api/tasks/${task.id}/github-link/${link.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEvents: [] }),
      },
    )
    const updatedLink = await jsonBody<GithubLinkResponse>(res)
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)

    expect(
      normalizeGithubLinkUpdateResult(
        res.status,
        updatedLink,
        detailBody.githubLinks,
      ),
    ).toEqual({
      status: 200,
      response: {
        ...normalizeLink(link),
        notifyEvents: [],
      },
      stored: [
        {
          ...normalizeLink(link),
          notifyEvents: [],
        },
      ],
    })
  })

  it('updates notification events for a blocker link', async () => {
    const task = await createTask('My task')
    const link = firstOrThrow(
      await db
        .insert(taskGithubLinks)
        .values({
          taskId: task.id,
          owner: 'example-owner',
          repo: 'example-repo',
          number: 7319,
          role: 'blocker',
          notifyEvents: defaultGithubNotifyEvents('blocker'),
          kind: 'issue',
          url: exampleGithubIssueUrl,
          state: 'open',
          title: 'An example issue',
        })
        .returning(),
    )

    const res = await app.request(
      `/api/tasks/${task.id}/github-link/${link.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEvents: ['closed', 'comments'] }),
      },
    )

    expect(
      normalizeGithubLinkResult(
        res.status,
        await jsonBody<GithubLinkResponse>(res),
      ),
    ).toEqual({
      status: 200,
      link: {
        id: 'ID',
        owner: 'example-owner',
        repo: 'example-repo',
        number: 7319,
        kind: 'issue',
        role: 'blocker',
        notifyEvents: ['closed', 'comments'],
        url: exampleGithubIssueUrl,
        state: 'open',
        title: 'An example issue',
        lastSyncedAt: 'DATE',
      },
    })
  })

  it('rejects unknown notify events', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: exampleGithubIssueUrl })
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: exampleGithubIssueUrl }),
    })
    const link = await jsonBody<GithubLinkResponse>(linkRes)

    const res = await app.request(
      `/api/tasks/${task.id}/github-link/${link.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEvents: ['unknown'] }),
      },
    )

    expect(res.status).toEqual(400)
  })

  it('returns 404 when the task has no link', async () => {
    const task = await createTask('My task')

    const res = await app.request(
      `/api/tasks/${task.id}/github-link/${TEST_UUID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEvents: ['closed'] }),
      },
    )

    expect(
      normalizeGithubLinkErrorResult(res.status, await res.json()),
    ).toEqual({
      status: 404,
      body: { error: 'GitHub link not found' },
    })
  })

  it('does not update a link that belongs to another task', async () => {
    const linkTask = await createTask('Linked task')
    const requestTask = await createTask('Other task')
    const link = firstOrThrow(
      await db
        .insert(taskGithubLinks)
        .values({
          taskId: linkTask.id,
          owner: 'example-owner',
          repo: 'example-repo',
          number: 7319,
          role: 'subject',
          notifyEvents: defaultGithubNotifyEvents('subject'),
          kind: 'issue',
          url: exampleGithubIssueUrl,
          state: 'open',
          title: 'An example issue',
        })
        .returning(),
    )

    const res = await app.request(
      `/api/tasks/${requestTask.id}/github-link/${link.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyEvents: ['comments'] }),
      },
    )
    const storedLink = firstOrThrow(
      await db
        .select()
        .from(taskGithubLinks)
        .where(eq(taskGithubLinks.id, link.id)),
    )

    expect(await readUpdateAttempt(res, storedLink)).toEqual({
      status: 404,
      body: { error: 'GitHub link not found' },
      taskId: linkTask.id,
      notifyEvents: defaultGithubNotifyEvents('subject'),
    })
  })
})

async function readUpdateAttempt(
  response: Response,
  link: { taskId: string; notifyEvents: string[] },
) {
  return {
    status: response.status,
    body: await response.json(),
    taskId: link.taskId,
    notifyEvents: link.notifyEvents,
  }
}

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
        toStatusReason: null,
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
        toStatusReason: null,
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
  it('syncs blocker links as well as subject links', async () => {
    const task = await createTask('Blocked task')
    const url = 'https://github.com/example-owner/example-repo/issues/17'
    await upsertGithubToken('valid-token')
    mockGithubActivityRoutes()
    mockGithubIssueResponse({ html_url: url, title: 'Open blocker' })
    const patchRes = await app.request(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedBy: [url] }),
    })

    mockGithubIssueResponse({
      html_url: url,
      state: 'closed',
      title: 'Resolved blocker',
    })
    const syncRes = await app.request(
      `/api/tasks/${task.id}/github-link/sync`,
      { method: 'POST' },
    )
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detail = await jsonBody<TaskResponse>(detailRes)
    const getActual = () => ({
      patchStatus: patchRes.status,
      syncStatus: syncRes.status,
      githubLinks: detail.githubLinks.map(normalizeLink),
      githubBlockers: (detail.githubBlockers ?? []).map(normalizeLink),
    })

    expect(getActual()).toEqual({
      patchStatus: 200,
      syncStatus: 204,
      githubLinks: [],
      githubBlockers: [
        {
          id: 'ID',
          owner: 'example-owner',
          repo: 'example-repo',
          number: 17,
          kind: 'issue',
          role: 'blocker',
          notifyEvents: ['closed'],
          url,
          state: 'closed',
          title: 'Resolved blocker',
          lastSyncedAt: 'DATE',
        },
      ],
    })
  })

  it('refreshes the link from GitHub, leaving the task untouched', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const link = await jsonBody<GithubLinkResponse>(linkRes)

    mockGithubIssueResponse({ title: 'Renamed on GitHub' })
    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    expect(res.status).toBe(204)
    const detailRes = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detailRes)
    expect(detailBody.title).toBe(task.title)
    expect(detailBody.githubLinks.map(normalizeLink)).toEqual([
      { ...normalizeLink(link), title: 'Renamed on GitHub' },
    ])
  })

  it('emits one task event for changed links with the requesting screen as origin', async () => {
    const task = await createTask('My task')
    const issueUrl = 'https://github.com/example-owner/example-repo/issues/42'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: issueUrl })
    await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: issueUrl }),
    })
    const events: ChangeEvent[] = []
    stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))

    mockGithubIssueResponse({ title: 'Renamed on GitHub', html_url: issueUrl })
    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
      headers: { 'X-Author': 'human:screen-id' },
    })

    const snapshot = () => ({ status: res.status, events })
    expect(snapshot()).toEqual({
      status: 204,
      events: [{ resource: 'task', id: task.id, origin: 'screen-id' }],
    })
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
    const events: ChangeEvent[] = []
    stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))

    const res = await app.request(`/api/tasks/${task.id}/github-link/sync`, {
      method: 'POST',
    })

    const snapshot = () => ({ status: res.status, events })
    expect(snapshot()).toEqual({ status: 204, events: [] })
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

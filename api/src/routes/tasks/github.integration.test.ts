import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import type { TaskResponse } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
  vi.restoreAllMocks()
})

async function createTaskFromGithub(url: string) {
  return app.request('/api/tasks/from-github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

function normalizeCreateResponse(body: {
  created: boolean
  task: TaskResponse
}) {
  return {
    ...body,
    task: {
      ...body.task,
      id: 'ID',
      number: 'NUMBER',
      createdAt: 'DATE',
      updatedAt: 'DATE',
      githubLinks: body.task.githubLinks.map((link) => ({
        ...link,
        id: 'ID',
        lastSyncedAt: 'DATE',
      })),
    },
  }
}

function normalizeChangeEvents(events: ChangeEvent[], taskId: string) {
  return events.map((event) => ({
    ...event,
    taskIds:
      event.taskIds?.map((id) => (id === taskId ? 'TASK_ID' : id)) ?? null,
  }))
}

describe('POST /api/tasks/from-github', () => {
  it('creates a task from the issue title, leaving the description empty', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const res = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )

    expect(res.status).toBe(201)
    const body = await jsonBody<{ created: boolean; task: TaskResponse }>(res)
    expect(normalizeCreateResponse(body)).toEqual({
      created: true,
      task: {
        id: 'ID',
        number: 'NUMBER',
        title: 'Bug: something broke',
        description: null,
        status: 'todo',
        statusReason: null,
        context: 'personal',
        commitment: 'inbox',
        labels: [],
        startDate: null,
        dueDate: null,
        remindAt: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        templateId: null,
        occurrenceDate: null,
        githubLinks: [
          {
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
          },
        ],
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    })
  })

  it('returns the existing task instead of creating a duplicate', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const first = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )
    const firstBody = await jsonBody<{ task: TaskResponse }>(first)

    const res = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )

    expect(res.status).toBe(200)
    const body = await jsonBody<{ created: boolean; task: TaskResponse }>(res)
    expect(body).toEqual({ created: false, task: firstBody.task })
  })

  it('publishes the created task ID in the change event', async () => {
    const url = 'https://github.com/example-owner/example-repo/issues/17'
    const events: ChangeEvent[] = []
    stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: url })

    const res = await createTaskFromGithub(url)
    const body = await jsonBody<{ created: boolean; task: TaskResponse }>(res)

    const snapshot = () => ({
      status: res.status,
      created: body.created,
      events: normalizeChangeEvents(events, body.task.id),
    })
    expect(snapshot()).toEqual({
      status: 201,
      created: true,
      events: [
        {
          resource: 'task',
          id: null,
          origin: null,
          taskIds: ['TASK_ID'],
        },
      ],
    })
  })

  it('returns 400 for a non-GitHub URL', async () => {
    const res = await createTaskFromGithub('https://example.com/not-github')

    expect(res.status).toBe(400)
  })

  it('returns 400 when GitHub is not connected', async () => {
    const res = await createTaskFromGithub(
      'https://github.com/fohte/tq/issues/42',
    )

    expect(res.status).toBe(400)
  })
})

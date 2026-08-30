import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import type { TaskResponse } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
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
      githubLink: body.task.githubLink && {
        ...body.task.githubLink,
        id: 'ID',
        lastSyncedAt: 'DATE',
      },
    },
  }
}

describe('POST /api/tasks/from-github', () => {
  it('creates a task from the issue title/body', async () => {
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
        description: 'Steps to reproduce...',
        status: 'todo',
        context: 'personal',
        commitment: 'active',
        labels: [],
        startDate: null,
        dueDate: null,
        estimatedMinutes: null,
        parentId: null,
        projectId: null,
        recurrenceRuleId: null,
        recurrenceRule: null,
        githubLink: {
          id: 'ID',
          owner: 'fohte',
          repo: 'tq',
          number: 42,
          kind: 'issue',
          url: 'https://github.com/fohte/tq/issues/42',
          state: 'open',
          title: 'Bug: something broke',
          lastSyncedAt: 'DATE',
        },
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

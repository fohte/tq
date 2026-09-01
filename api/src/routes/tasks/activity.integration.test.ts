import { describe, expect, it } from 'vitest'

import { app } from '#app'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { createComment, createTask } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface ActivityItem {
  id: string
  type: 'created' | 'status_changed' | 'github_linked' | 'github_unlinked'
  createdAt: string
  author: { kind: 'human' | 'llm' | 'system'; agent: string | null }
  fromStatus?: 'todo' | 'in_progress' | 'completed'
  toStatus?: 'todo' | 'in_progress' | 'completed'
  owner?: string
  repo?: string
  number?: number
  kind?: 'issue' | 'pull_request'
}

function normalize(items: ActivityItem[]) {
  return items.map((item) => ({ ...item, id: 'ID', createdAt: 'DATE' }))
}

describe('GET /api/tasks/:id/activity', () => {
  it('returns create, status_changed, and github link/unlink events in chronological order, excluding comments', async () => {
    const task = await createTask('My task')
    await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const linkRes = await app.request(`/api/tasks/${task.id}/github-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://github.com/fohte/tq/issues/42' }),
    })
    const link = await jsonBody<{ id: string }>(linkRes)
    await app.request(`/api/tasks/${task.id}/github-link/${link.id}`, {
      method: 'DELETE',
    })
    await createComment(task.id, 'This should not appear')

    const res = await app.request(`/api/tasks/${task.id}/activity`)

    expect(res.status).toBe(200)
    const body = await jsonBody<ActivityItem[]>(res)
    expect(normalize(body)).toEqual([
      {
        id: 'ID',
        createdAt: 'DATE',
        type: 'created',
        author: { kind: 'human', agent: null },
      },
      {
        id: 'ID',
        createdAt: 'DATE',
        type: 'status_changed',
        author: { kind: 'human', agent: null },
        fromStatus: 'todo',
        toStatus: 'completed',
      },
      {
        id: 'ID',
        createdAt: 'DATE',
        type: 'github_linked',
        author: { kind: 'human', agent: null },
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
      },
      {
        id: 'ID',
        createdAt: 'DATE',
        type: 'github_unlinked',
        author: { kind: 'human', agent: null },
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
      },
    ])
  })

  it('returns 404 for a non-existent task', async () => {
    const res = await app.request(
      '/api/tasks/550e8400-e29b-41d4-a716-446655440000/activity',
    )

    expect(res.status).toBe(404)
  })
})

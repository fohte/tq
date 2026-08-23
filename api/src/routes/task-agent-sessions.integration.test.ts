import { eq } from 'drizzle-orm'
import { describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { agentSessions } from '#db/schema'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface AgentSessionResponse {
  id: string
  provider: string
  sessionId: string
  context: string
  cwd: string
  label: string | null
  lastMessage: string | null
  customLabel: string | null
  startedAt: string
  lastActiveAt: string
  endedAt: string | null
}

interface TaskLinkResponse {
  id: string
  number: number
  title: string
  status: string
}

describe('task <-> agent session links API', () => {
  describe('POST /api/tasks/:taskId/agent-sessions', () => {
    it('links an agent session to a task', async () => {
      const task = await createTask('My task')
      const session = await createAgentSession('session-1')

      const res = await postLink(task.id, session.id)

      expect(res.status).toBe(201)
      expect(await jsonBody<AgentSessionResponse>(res)).toEqual(session)
    })

    it('is idempotent when the link already exists', async () => {
      const task = await createTask('My task')
      const session = await createAgentSession('session-1')
      await postLink(task.id, session.id)

      const res = await postLink(task.id, session.id)

      expect(res.status).toBe(200)
      expect(await jsonBody<AgentSessionResponse>(res)).toEqual(session)
    })

    it('accepts the task number in place of the UUID', async () => {
      const task = await createTask('My task')
      const session = await createAgentSession('session-1')

      const res = await postLink(String(task.number), session.id)

      expect(res.status).toBe(201)
    })

    it('returns 404 for a non-existent task', async () => {
      const session = await createAgentSession('session-1')

      const res = await postLink(TEST_UUID, session.id)

      expect(res.status).toBe(404)
    })

    it('returns 404 for a non-existent agent session', async () => {
      const task = await createTask('My task')

      const res = await postLink(task.id, TEST_UUID)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/tasks/:taskId/agent-sessions', () => {
    it('returns empty list when no sessions are linked', async () => {
      const task = await createTask('My task')

      const res = await app.request(`/api/tasks/${task.id}/agent-sessions`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns linked sessions ordered by most recently active', async () => {
      const task = await createTask('My task')
      const older = await createAgentSessionAtTime(
        'session-older',
        '2030-01-01T00:00:00.000Z',
      )
      const newer = await createAgentSessionAtTime(
        'session-newer',
        '2030-01-02T00:00:00.000Z',
      )
      await postLink(task.id, older.id)
      await postLink(task.id, newer.id)

      const res = await app.request(`/api/tasks/${task.id}/agent-sessions`)

      expect(res.status).toBe(200)
      expect(await jsonBody<AgentSessionResponse[]>(res)).toEqual([
        newer,
        older,
      ])
    })

    it('does not return sessions linked to other tasks', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      const session = await createAgentSession('session-1')
      await postLink(task2.id, session.id)

      const res = await app.request(`/api/tasks/${task1.id}/agent-sessions`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns 404 for a non-existent task', async () => {
      const res = await app.request(`/api/tasks/${TEST_UUID}/agent-sessions`)

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/tasks/:taskId/agent-sessions/:agentSessionId', () => {
    it('unlinks an agent session from a task', async () => {
      const task = await createTask('My task')
      const session = await createAgentSession('session-1')
      await postLink(task.id, session.id)

      const res = await app.request(
        `/api/tasks/${task.id}/agent-sessions/${session.id}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(204)

      const listRes = await app.request(`/api/tasks/${task.id}/agent-sessions`)
      expect(await listRes.json()).toEqual([])
    })

    it('returns 404 when the link does not exist', async () => {
      const task = await createTask('My task')
      const session = await createAgentSession('session-1')

      const res = await app.request(
        `/api/tasks/${task.id}/agent-sessions/${session.id}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(404)
    })

    it('returns 404 for a non-existent task', async () => {
      const res = await app.request(
        `/api/tasks/${TEST_UUID}/agent-sessions/${TEST_UUID}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/agent-sessions/:id/tasks', () => {
    it('returns empty list when the session has no linked tasks', async () => {
      const session = await createAgentSession('session-1')

      const res = await app.request(`/api/agent-sessions/${session.id}/tasks`)

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns linked tasks ordered by task number', async () => {
      const session = await createAgentSession('session-1')
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      await postLink(task2.id, session.id)
      await postLink(task1.id, session.id)

      const res = await app.request(`/api/agent-sessions/${session.id}/tasks`)

      expect(res.status).toBe(200)
      expect(await jsonBody<TaskLinkResponse[]>(res)).toEqual([
        { id: task1.id, number: task1.number, title: 'Task 1', status: 'todo' },
        { id: task2.id, number: task2.number, title: 'Task 2', status: 'todo' },
      ])
    })

    it('returns 404 for a non-existent agent session', async () => {
      const res = await app.request(`/api/agent-sessions/${TEST_UUID}/tasks`)

      expect(res.status).toBe(404)
    })
  })

  it('removes the link when the linked task is deleted', async () => {
    const task = await createTask('My task')
    const session = await createAgentSession('session-1')
    await postLink(task.id, session.id)

    const res = await app.request(`/api/tasks/${task.id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)

    const tasksRes = await app.request(
      `/api/agent-sessions/${session.id}/tasks`,
    )
    expect(await tasksRes.json()).toEqual([])
  })

  it('removes the link when the linked agent session is deleted', async () => {
    const task = await createTask('My task')
    const session = await createAgentSession('session-1')
    await postLink(task.id, session.id)

    await db.delete(agentSessions).where(eq(agentSessions.id, session.id))

    const sessionsRes = await app.request(
      `/api/tasks/${task.id}/agent-sessions`,
    )
    expect(await sessionsRes.json()).toEqual([])
  })
})

async function createTask(title: string) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create task: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<{ id: string; number: number; title: string }>(res)
}

async function createAgentSession(sessionId: string) {
  const res = await app.request('/api/agent-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      provider: 'claude_code',
      sessionId,
      cwd: '/tmp/example',
      label: null,
      lastMessage: null,
    }),
  })
  if (res.status !== 200) {
    throw new Error(
      `Failed to create agent session: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<AgentSessionResponse>(res)
}

async function createAgentSessionAtTime(sessionId: string, time: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(time))
  const body = await createAgentSession(sessionId)
  vi.useRealTimers()
  return body
}

async function postLink(taskId: string, agentSessionId: string) {
  return app.request(`/api/tasks/${taskId}/agent-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentSessionId }),
  })
}

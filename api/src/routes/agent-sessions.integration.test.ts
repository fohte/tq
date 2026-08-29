import { describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface AgentSessionResponse {
  id: string
  provider: string
  sessionId: string
  parentSessionId: string | null
  context: 'work' | 'personal'
  cwd: string
  label: string | null
  lastMessage: string | null
  customLabel: string | null
  startedAt: string
  lastActiveAt: string
  endedAt: string | null
}

interface TaskAgentSessionResponse extends AgentSessionResponse {
  taskId: string
  taskNumber: number
  taskTitle: string
  taskParentId: string | null
}

function normalizeSession(session: AgentSessionResponse) {
  return {
    ...session,
    startedAt: 'DATE',
    lastActiveAt: 'DATE',
    endedAt: session.endedAt === null ? null : 'DATE',
  }
}

describe('agent sessions API', () => {
  describe('POST /api/agent-sessions', () => {
    it('creates a new session on first report', async () => {
      const res = await upsertSession({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'Working on tq',
        lastMessage: 'Implemented the feature',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      assertDefined(body.id)
      expect(normalizeSession(body)).toEqual({
        id: body.id,
        provider: 'claude_code',
        sessionId: 'session-1',
        parentSessionId: null,
        context: 'work',
        cwd: '/home/fohte/project',
        label: 'Working on tq',
        lastMessage: 'Implemented the feature',
        customLabel: null,
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: null,
      })
    })

    it('defaults context to personal when omitted', async () => {
      const res = await upsertSession({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(normalizeSession(body)).toEqual({
        id: body.id,
        provider: 'claude_code',
        sessionId: 'session-1',
        parentSessionId: null,
        context: 'personal',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
        customLabel: null,
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: null,
      })
    })

    it('updates label, last message, and last active time on a later report, preserving startedAt', async () => {
      const created = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-1',
          cwd: '/home/fohte/project',
          context: 'work',
          label: 'First label',
          lastMessage: 'First message',
        },
        '2030-01-01T00:00:00.000Z',
      )

      const body = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-1',
          cwd: '/home/fohte/project',
          context: 'work',
          label: 'Second label',
          lastMessage: 'Second message',
        },
        '2030-01-02T00:00:00.000Z',
      )

      // `startedAt` defaults from Postgres's `now()`, frozen at this test's
      // transaction start (see setupTestDb), so faking JS time above only
      // moves `lastActiveAt` — letting this check pin the exact value instead
      // of normalizing it away.
      expect(body).toEqual({
        id: created.id,
        provider: 'claude_code',
        sessionId: 'session-1',
        parentSessionId: null,
        context: 'work',
        cwd: '/home/fohte/project',
        label: 'Second label',
        lastMessage: 'Second message',
        customLabel: null,
        startedAt: created.startedAt,
        lastActiveAt: '2030-01-02T00:00:00.000Z',
        endedAt: null,
      })
    })

    it('clears endedAt when the session reports activity again after ending', async () => {
      const ended = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
        ended: true,
      })
      assertDefined(ended.endedAt)

      const res = await upsertSession({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(normalizeSession(body)).toEqual({
        id: ended.id,
        provider: 'claude_code',
        sessionId: 'session-1',
        parentSessionId: null,
        context: 'work',
        cwd: '/home/fohte/project',
        label: 'A label',
        lastMessage: 'A message',
        customLabel: null,
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: null,
      })
    })

    it('keeps a human-assigned custom label across later reports', async () => {
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'First label',
        lastMessage: 'First message',
      })

      await patchCustomLabel(created.id, 'My custom name')

      const res = await upsertSession({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'Second label',
        lastMessage: 'Second message',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(normalizeSession(body)).toEqual({
        id: created.id,
        provider: 'claude_code',
        sessionId: 'session-1',
        parentSessionId: null,
        context: 'work',
        cwd: '/home/fohte/project',
        label: 'Second label',
        lastMessage: 'Second message',
        customLabel: 'My custom name',
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: null,
      })
    })

    it('sets endedAt when reporting the session as ended', async () => {
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
      })

      const res = await upsertSession({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
        ended: true,
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(normalizeSession(body)).toEqual({
        id: created.id,
        provider: 'claude_code',
        sessionId: 'session-1',
        parentSessionId: null,
        context: 'work',
        cwd: '/home/fohte/project',
        label: 'A label',
        lastMessage: 'A message',
        customLabel: null,
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: 'DATE',
      })
    })

    it('records the parent session id on first report', async () => {
      const res = await upsertSession({
        provider: 'claude_code',
        sessionId: 'child-session',
        parentSessionId: 'parent-session',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(normalizeSession(body)).toEqual({
        id: body.id,
        provider: 'claude_code',
        sessionId: 'child-session',
        parentSessionId: 'parent-session',
        context: 'personal',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
        customLabel: null,
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: null,
      })
    })

    it('does not overwrite the recorded parent session id on a later report', async () => {
      const created = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'child-session',
          parentSessionId: 'parent-session',
          cwd: '/home/fohte/project',
          label: null,
          lastMessage: null,
        },
        '2030-01-01T00:00:00.000Z',
      )

      const body = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'child-session',
          parentSessionId: 'a-different-parent',
          cwd: '/home/fohte/project',
          label: null,
          lastMessage: null,
        },
        '2030-01-02T00:00:00.000Z',
      )

      expect(body).toEqual({
        ...created,
        parentSessionId: 'parent-session',
        lastActiveAt: '2030-01-02T00:00:00.000Z',
      })
    })

    it('links to every task the parent is linked to', async () => {
      const task = await createTask('My task')
      const parent = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'parent-session',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })
      await postLink(task.id, parent.id)

      const child = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'child-session',
        parentSessionId: 'parent-session',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })

      const tasksRes = await app.request(
        `/api/agent-sessions/${child.id}/tasks`,
      )
      expect(await jsonBody<{ id: string }[]>(tasksRes)).toEqual([
        { id: task.id, number: task.number, title: 'My task', status: 'todo' },
      ])
    })

    it('does not link to any task when the parent session is unresolvable', async () => {
      const child = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'child-session',
        parentSessionId: 'nonexistent-parent',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })

      const tasksRes = await app.request(
        `/api/agent-sessions/${child.id}/tasks`,
      )
      expect(await tasksRes.json()).toEqual([])
    })

    it('does not re-add a task link on a later report of an already-known session', async () => {
      const task = await createTask('My task')
      const parent = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'parent-session',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })
      await postLink(task.id, parent.id)
      const child = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'child-session',
        parentSessionId: 'parent-session',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })
      await app.request(`/api/tasks/${task.id}/agent-sessions/${child.id}`, {
        method: 'DELETE',
      })

      await upsertSession({
        provider: 'claude_code',
        sessionId: 'child-session',
        parentSessionId: 'parent-session',
        cwd: '/home/fohte/project',
        label: null,
        lastMessage: null,
      })

      const tasksRes = await app.request(
        `/api/agent-sessions/${child.id}/tasks`,
      )
      expect(await tasksRes.json()).toEqual([])
    })
  })

  describe('GET /api/agent-sessions', () => {
    it('returns an empty list when no sessions exist', async () => {
      const res = await app.request('/api/agent-sessions')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns sessions ordered by most recently active first', async () => {
      // lastActiveAt is set from application-side `new Date()`, not
      // Postgres's frozen `now()`, so two real back-to-back calls aren't
      // guaranteed distinct — fake time to force a deterministic order.
      const older = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'older',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-01T00:00:00.000Z',
      )
      const newer = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'newer',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-02T00:00:00.000Z',
      )

      const res = await app.request('/api/agent-sessions')

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse[]>(res)
      expect(body.map((session) => session.id)).toEqual([newer.id, older.id])
    })
  })

  describe('GET /api/agent-sessions/:id', () => {
    it('returns a single session', async () => {
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
      })

      const res = await app.request(`/api/agent-sessions/${created.id}`)

      expect(res.status).toBe(200)
      expect(await jsonBody<AgentSessionResponse>(res)).toEqual(created)
    })

    it('returns 404 for a non-existent session', async () => {
      const res = await app.request(`/api/agent-sessions/${TEST_UUID}`)

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/agent-sessions/by-task', () => {
    it('returns an empty list when no sessions are linked', async () => {
      const res = await app.request('/api/agent-sessions/by-task')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns both sessions linked to a single task', async () => {
      const task = await createTask('My task')
      const older = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-1',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-01T00:00:00.000Z',
      )
      const newer = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-2',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-02T00:00:00.000Z',
      )
      await postLink(task.id, older.id)
      await postLink(task.id, newer.id)

      const res = await app.request('/api/agent-sessions/by-task')

      expect(res.status).toBe(200)
      expect(await jsonBody<TaskAgentSessionResponse[]>(res)).toEqual([
        {
          taskId: task.id,
          taskNumber: task.number,
          taskTitle: task.title,
          taskParentId: null,
          ...newer,
        },
        {
          taskId: task.id,
          taskNumber: task.number,
          taskTitle: task.title,
          taskParentId: null,
          ...older,
        },
      ])
    })

    it('returns each session with the taskId of the task it is linked to', async () => {
      const task1 = await createTask('Task 1')
      const task2 = await createTask('Task 2')
      const olderSession = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-1',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-01T00:00:00.000Z',
      )
      const newerSession = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-2',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-02T00:00:00.000Z',
      )
      await postLink(task1.id, olderSession.id)
      await postLink(task2.id, newerSession.id)

      const res = await app.request('/api/agent-sessions/by-task')

      expect(res.status).toBe(200)
      expect(await jsonBody<TaskAgentSessionResponse[]>(res)).toEqual([
        {
          taskId: task2.id,
          taskNumber: task2.number,
          taskTitle: task2.title,
          taskParentId: null,
          ...newerSession,
        },
        {
          taskId: task1.id,
          taskNumber: task1.number,
          taskTitle: task1.title,
          taskParentId: null,
          ...olderSession,
        },
      ])
    })

    it('returns the parent task id for a subtask', async () => {
      const parent = await createTask('Parent task')
      const child = await createTask('Child task', parent.id)
      const session = await upsertSessionAtTime(
        {
          provider: 'claude_code',
          sessionId: 'session-1',
          cwd: '/home/fohte/project',
          context: 'work',
          label: null,
          lastMessage: null,
        },
        '2030-01-01T00:00:00.000Z',
      )
      await postLink(child.id, session.id)

      const res = await app.request('/api/agent-sessions/by-task')

      expect(res.status).toBe(200)
      expect(await jsonBody<TaskAgentSessionResponse[]>(res)).toEqual([
        {
          taskId: child.id,
          taskNumber: child.number,
          taskTitle: child.title,
          taskParentId: parent.id,
          ...session,
        },
      ])
    })
  })

  describe('PATCH /api/agent-sessions/:id', () => {
    it('sets the custom label', async () => {
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
      })

      const res = await patchCustomLabel(created.id, 'my renamed session')

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(body).toEqual({ ...created, customLabel: 'my renamed session' })
    })

    it('clears the custom label when set to null', async () => {
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
      })
      await patchCustomLabel(created.id, 'temporary name')

      const res = await patchCustomLabel(created.id, null)

      expect(res.status).toBe(200)
      const body = await jsonBody<AgentSessionResponse>(res)
      expect(body).toEqual({ ...created, customLabel: null })
    })

    it('returns 404 for a non-existent session', async () => {
      const res = await patchCustomLabel(TEST_UUID, 'name')

      expect(res.status).toBe(404)
    })

    it('returns 400 for an empty custom label', async () => {
      const res = await patchCustomLabel(TEST_UUID, '')

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/agent-sessions/by-session/:provider/:sessionId', () => {
    it('resolves a session by provider and session id', async () => {
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'A label',
        lastMessage: 'A message',
      })

      const res = await app.request(
        '/api/agent-sessions/by-session/claude_code/session-1',
      )

      expect(res.status).toBe(200)
      expect(await jsonBody<AgentSessionResponse>(res)).toEqual(created)
    })

    it('returns 404 for a non-existent session id', async () => {
      const res = await app.request(
        '/api/agent-sessions/by-session/claude_code/nonexistent',
      )

      expect(res.status).toBe(404)
    })

    it('returns 404 for an unknown provider', async () => {
      const res = await app.request(
        '/api/agent-sessions/by-session/other_provider/session-1',
      )

      expect(res.status).toBe(404)
    })
  })
})

interface UpsertSessionInput {
  provider: 'claude_code'
  sessionId: string
  parentSessionId?: string
  cwd: string
  context?: 'work' | 'personal'
  label: string | null
  lastMessage: string | null
  ended?: boolean
}

function upsertSession(input: UpsertSessionInput) {
  return app.request('/api/agent-sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

async function upsertSessionAndGetBody(input: UpsertSessionInput) {
  const res = await upsertSession(input)
  if (res.status !== 200) {
    throw new Error(
      `Failed to upsert agent session: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<AgentSessionResponse>(res)
}

async function upsertSessionAtTime(input: UpsertSessionInput, time: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(time))
  const body = await upsertSessionAndGetBody(input)
  vi.useRealTimers()
  return body
}

async function createTask(title: string, parentId?: string) {
  const res = await app.request('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, parentId }),
  })
  if (res.status !== 201) {
    throw new Error(
      `Failed to create task: ${String(res.status)} ${await res.text()}`,
    )
  }
  return jsonBody<{ id: string; number: number; title: string }>(res)
}

async function postLink(taskId: string, agentSessionId: string) {
  const res = await app.request(`/api/tasks/${taskId}/agent-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentSessionId }),
  })
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(
      `Failed to link agent session: ${String(res.status)} ${await res.text()}`,
    )
  }
  return res
}

function patchCustomLabel(id: string, customLabel: string | null) {
  return app.request(`/api/agent-sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customLabel }),
  })
}

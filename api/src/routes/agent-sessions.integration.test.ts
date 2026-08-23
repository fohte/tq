import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { agentSessions } from '#db/schema'
import { assertDefined, jsonBody, setupTestDb } from '#testing'

setupTestDb()

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface AgentSessionResponse {
  id: string
  provider: string
  sessionId: string
  context: 'work' | 'personal'
  cwd: string
  label: string | null
  lastMessage: string | null
  customLabel: string | null
  startedAt: string
  lastActiveAt: string
  endedAt: string | null
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
      const created = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'session-1',
        cwd: '/home/fohte/project',
        context: 'work',
        label: 'First label',
        lastMessage: 'First message',
      })

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
        context: 'work',
        cwd: '/home/fohte/project',
        label: 'Second label',
        lastMessage: 'Second message',
        customLabel: null,
        startedAt: 'DATE',
        lastActiveAt: 'DATE',
        endedAt: null,
      })
      expect(body.startedAt).toBe(created.startedAt)
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

      // Simulates a human assigning a custom label through a future tq-UI
      // feature; no API endpoint sets this column in this PR.
      await db
        .update(agentSessions)
        .set({ customLabel: 'My custom name' })
        .where(eq(agentSessions.id, created.id))

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
  })

  describe('GET /api/agent-sessions', () => {
    it('returns an empty list when no sessions exist', async () => {
      const res = await app.request('/api/agent-sessions')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns sessions ordered by most recently active first', async () => {
      const older = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'older',
        cwd: '/home/fohte/project',
        context: 'work',
        label: null,
        lastMessage: null,
      })
      const newer = await upsertSessionAndGetBody({
        provider: 'claude_code',
        sessionId: 'newer',
        cwd: '/home/fohte/project',
        context: 'work',
        label: null,
        lastMessage: null,
      })

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
})

interface UpsertSessionInput {
  provider: 'claude_code'
  sessionId: string
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

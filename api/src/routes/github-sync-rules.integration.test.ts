import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import {
  githubSyncRuleIgnoredIssues,
  githubSyncRules,
  projects,
  tasks,
} from '#db/schema'
import {
  mockAssignedIssuesResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { firstOrThrow } from '#lib/drizzle-utils'
import { syncGithubAssignedIssues } from '#services/github-sync-rules'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

const TEST_UUID = '550e8400-e29b-41d4-a716-446655440000'

interface SyncRuleResponse {
  id: string
  scope: 'all' | 'org' | 'repo'
  org: string | null
  repo: string | null
  trigger: 'assigned'
  targetProjectId: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

function normalizeRule(rule: SyncRuleResponse) {
  return { ...rule, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

async function createProject(title: string) {
  return firstOrThrow(await db.insert(projects).values({ title }).returning())
}

async function createRule(body: Record<string, unknown>) {
  return app.request('/api/github/sync-rules', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/github/sync-rules', () => {
  it('creates a scope-all rule', async () => {
    const project = await createProject('Inbox')

    const res = await createRule({ scope: 'all', targetProjectId: project.id })

    expect(res.status).toBe(201)
    const body = await jsonBody<SyncRuleResponse>(res)
    expect(normalizeRule(body)).toEqual({
      id: 'ID',
      scope: 'all',
      org: null,
      repo: null,
      trigger: 'assigned',
      targetProjectId: project.id,
      enabled: true,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('creates an org-scoped rule', async () => {
    const project = await createProject('Inbox')

    const res = await createRule({
      scope: 'org',
      org: 'fohte',
      targetProjectId: project.id,
    })

    expect(res.status).toBe(201)
    const body = await jsonBody<SyncRuleResponse>(res)
    expect(normalizeRule(body)).toEqual({
      id: 'ID',
      scope: 'org',
      org: 'fohte',
      repo: null,
      trigger: 'assigned',
      targetProjectId: project.id,
      enabled: true,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('creates a repo-scoped rule', async () => {
    const project = await createProject('Inbox')

    const res = await createRule({
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      targetProjectId: project.id,
    })

    expect(res.status).toBe(201)
    const body = await jsonBody<SyncRuleResponse>(res)
    expect(normalizeRule(body)).toEqual({
      id: 'ID',
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      trigger: 'assigned',
      targetProjectId: project.id,
      enabled: true,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it.each([
    ['scope all with org set', { scope: 'all', org: 'fohte' }],
    ['scope org missing org', { scope: 'org' }],
    ['scope org with repo set', { scope: 'org', org: 'fohte', repo: 'tq' }],
    ['scope repo missing repo', { scope: 'repo', org: 'fohte' }],
    ['scope repo missing org', { scope: 'repo', repo: 'tq' }],
  ])('returns 400 for %s', async (_label, overrides) => {
    const project = await createProject('Inbox')

    const res = await createRule({ targetProjectId: project.id, ...overrides })

    expect(res.status).toBe(400)
  })

  it('does not create tasks for already-assigned issues on the first sync when includeExisting is omitted from the create request', async () => {
    const project = await createProject('Inbox')
    await createRule({ scope: 'all', targetProjectId: project.id })
    await upsertGithubToken('valid-token')
    mockAssignedIssuesResponse([{ owner: 'fohte', repo: 'tq', number: 42 }])

    await syncGithubAssignedIssues()

    expect(await db.select().from(tasks)).toEqual([])
  })

  it('does not seed ignores when includeExisting is true', async () => {
    const project = await createProject('Inbox')

    const res = await createRule({
      scope: 'all',
      targetProjectId: project.id,
      includeExisting: true,
    })

    const body = await jsonBody<SyncRuleResponse>(res)
    const row = await db.query.githubSyncRules.findFirst({
      where: eq(githubSyncRules.id, body.id),
    })
    expect(row?.seedIgnoreOnNextSync).toBe(false)
  })

  it('returns 409 when an enabled rule already exists for the same scope', async () => {
    const project = await createProject('Inbox')
    await createRule({
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      targetProjectId: project.id,
    })

    const res = await createRule({
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      targetProjectId: project.id,
    })

    expect(res.status).toBe(409)
    const listRes = await app.request('/api/github/sync-rules')
    const rules = await jsonBody<SyncRuleResponse[]>(listRes)
    expect(rules).toHaveLength(1)
  })

  it('allows creating a rule when the only existing match for the same scope is disabled', async () => {
    const project = await createProject('Inbox')
    const disabled = await jsonBody<SyncRuleResponse>(
      await createRule({
        scope: 'repo',
        org: 'fohte',
        repo: 'tq',
        targetProjectId: project.id,
      }),
    )
    await app.request(`/api/github/sync-rules/${disabled.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })

    const res = await createRule({
      scope: 'repo',
      org: 'fohte',
      repo: 'tq',
      targetProjectId: project.id,
    })

    expect(res.status).toBe(201)
  })
})

describe('GET /api/github/sync-rules', () => {
  it('returns an empty list when no rules exist', async () => {
    const res = await app.request('/api/github/sync-rules')

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('lists rules ordered by creation time', async () => {
    const project = await createProject('Inbox')
    const first = await jsonBody<SyncRuleResponse>(
      await createRule({ scope: 'all', targetProjectId: project.id }),
    )
    const second = await jsonBody<SyncRuleResponse>(
      await createRule({
        scope: 'org',
        org: 'fohte',
        targetProjectId: project.id,
      }),
    )

    const res = await app.request('/api/github/sync-rules')

    expect(res.status).toBe(200)
    const body = await jsonBody<SyncRuleResponse[]>(res)
    expect(body.map((r) => r.id)).toEqual([first.id, second.id])
  })
})

describe('PATCH /api/github/sync-rules/:id', () => {
  it('updates enabled and targetProjectId', async () => {
    const project = await createProject('Inbox')
    const otherProject = await createProject('Other')
    const created = await jsonBody<SyncRuleResponse>(
      await createRule({ scope: 'all', targetProjectId: project.id }),
    )

    const res = await app.request(`/api/github/sync-rules/${created.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        enabled: false,
        targetProjectId: otherProject.id,
      }),
    })

    expect(res.status).toBe(200)
    const body = await jsonBody<SyncRuleResponse>(res)
    expect(normalizeRule(body)).toEqual({
      id: 'ID',
      scope: 'all',
      org: null,
      repo: null,
      trigger: 'assigned',
      targetProjectId: otherProject.id,
      enabled: false,
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns 404 for a non-existent rule', async () => {
    const res = await app.request(`/api/github/sync-rules/${TEST_UUID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/github/sync-rules/:id', () => {
  it('deletes a rule', async () => {
    const project = await createProject('Inbox')
    const created = await jsonBody<SyncRuleResponse>(
      await createRule({ scope: 'all', targetProjectId: project.id }),
    )

    const res = await app.request(`/api/github/sync-rules/${created.id}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(204)
    const listRes = await app.request('/api/github/sync-rules')
    expect(await jsonBody<SyncRuleResponse[]>(listRes)).toEqual([])
  })

  it('cascades its ignored-issue rows when the rule is deleted', async () => {
    const project = await createProject('Inbox')
    const created = await jsonBody<SyncRuleResponse>(
      await createRule({ scope: 'all', targetProjectId: project.id }),
    )
    await db.insert(githubSyncRuleIgnoredIssues).values({
      ruleId: created.id,
      owner: 'fohte',
      repo: 'tq',
      number: 1,
    })

    await app.request(`/api/github/sync-rules/${created.id}`, {
      method: 'DELETE',
    })

    expect(
      await db
        .select()
        .from(githubSyncRuleIgnoredIssues)
        .where(eq(githubSyncRuleIgnoredIssues.ruleId, created.id)),
    ).toEqual([])
  })

  it('returns 404 for a non-existent rule', async () => {
    const res = await app.request(`/api/github/sync-rules/${TEST_UUID}`, {
      method: 'DELETE',
    })

    expect(res.status).toBe(404)
  })
})

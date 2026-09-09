import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { projects, recurrenceRules, recurringTaskTemplates } from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

interface RecurrenceRuleResponse {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek: number[] | null
  dayOfMonth: number | null
}

interface TemplateResponse {
  id: string
  title: string
  description: string | null
  estimatedMinutes: number | null
  projectId: string | null
  parentId: string | null
  context: 'work' | 'personal'
  labels: string[]
  recurrenceRuleId: string
  recurrenceRule: RecurrenceRuleResponse
  startOffsetDays: number | null
  anchorDate: string
  lastGeneratedDate: string | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

async function createProject(title: string) {
  return firstOrThrow(await db.insert(projects).values({ title }).returning())
}

function postTemplate(body: Record<string, unknown>) {
  return app.request('/api/recurring-task-templates', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patchTemplate(id: string, body: Record<string, unknown>) {
  return app.request(`/api/recurring-task-templates/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function createTemplate(
  title: string,
  recurrenceRule: {
    type: string
    interval: number
    daysOfWeek?: number[]
    dayOfMonth?: number
  },
  anchorDate: string,
  opts: {
    description?: string
    estimatedMinutes?: number
    projectId?: string
    parentId?: string
    context?: string
    labels?: string[]
    startOffsetDays?: number
    enabled?: boolean
  } = {},
) {
  const res = await postTemplate({
    title,
    recurrenceRule,
    anchorDate,
    ...opts,
  })
  if (res.status !== 201) {
    expect(res.status, `Failed to create template: ${await res.text()}`).toBe(
      201,
    )
  }
  return jsonBody<TemplateResponse>(res)
}

// `recurrenceRuleId`/`recurrenceRule.id` and `createdAt`/`updatedAt` are
// freshly generated on every create/update, so a literal comparison needs
// them replaced with fixed placeholders. `labels` has no defined order (see
// `getTemplateLabelNames`), so it's sorted too.
function normalizeTemplate(template: TemplateResponse) {
  return {
    ...template,
    id: 'ID',
    recurrenceRuleId: 'RULE_ID',
    recurrenceRule: { ...template.recurrenceRule, id: 'RULE_ID' },
    labels: template.labels.toSorted(),
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

describe('recurring task templates CRUD API', () => {
  describe('POST /api/recurring-task-templates', () => {
    it('creates a template with only the required fields', async () => {
      const res = await postTemplate({
        title: 'Daily standup',
        recurrenceRule: { type: 'daily', interval: 1 },
        anchorDate: '2026-04-01',
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        id: 'ID',
        title: 'Daily standup',
        description: null,
        estimatedMinutes: null,
        projectId: null,
        parentId: null,
        context: 'personal',
        labels: [],
        recurrenceRuleId: 'RULE_ID',
        recurrenceRule: {
          id: 'RULE_ID',
          type: 'daily',
          interval: 1,
          daysOfWeek: null,
          dayOfMonth: null,
        },
        startOffsetDays: null,
        anchorDate: '2026-04-01',
        lastGeneratedDate: null,
        enabled: true,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      })
    })

    it('creates a template with all optional fields', async () => {
      const project = await createProject('Some project')
      const parent = await createTask('Parent task')

      const res = await postTemplate({
        title: 'Weekly review',
        description: 'Review the week',
        estimatedMinutes: 45,
        projectId: project.id,
        parentId: parent.id,
        context: 'work',
        labels: ['label-a', 'label-b'],
        recurrenceRule: { type: 'weekly', interval: 2, daysOfWeek: [1, 3] },
        startOffsetDays: 2,
        anchorDate: '2026-04-06',
        enabled: false,
      })

      expect(res.status).toBe(201)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        id: 'ID',
        title: 'Weekly review',
        description: 'Review the week',
        estimatedMinutes: 45,
        projectId: project.id,
        parentId: parent.id,
        context: 'work',
        labels: ['label-a', 'label-b'],
        recurrenceRuleId: 'RULE_ID',
        recurrenceRule: {
          id: 'RULE_ID',
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1, 3],
          dayOfMonth: null,
        },
        startOffsetDays: 2,
        anchorDate: '2026-04-06',
        lastGeneratedDate: null,
        enabled: false,
        createdAt: 'TIMESTAMP',
        updatedAt: 'TIMESTAMP',
      })
    })

    it('returns 400 when title is missing', async () => {
      const res = await postTemplate({
        recurrenceRule: { type: 'daily', interval: 1 },
        anchorDate: '2026-04-01',
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 when recurrenceRule is missing', async () => {
      const res = await postTemplate({
        title: 'No recurrence',
        anchorDate: '2026-04-01',
      })

      expect(res.status).toBe(400)
    })

    it('returns 400 when anchorDate is missing', async () => {
      const res = await postTemplate({
        title: 'No anchor date',
        recurrenceRule: { type: 'daily', interval: 1 },
      })

      expect(res.status).toBe(400)
    })

    it('returns 404 for a non-existent parentId', async () => {
      const res = await postTemplate({
        title: 'Orphaned template',
        recurrenceRule: { type: 'daily', interval: 1 },
        anchorDate: '2026-04-01',
        parentId: TEST_UUID,
      })

      expect(res.status).toBe(404)
    })
  })

  describe('GET /api/recurring-task-templates', () => {
    it('returns an empty list when none exist', async () => {
      const res = await app.request('/api/recurring-task-templates')

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual([])
    })

    it('returns created templates', async () => {
      await createTemplate(
        'Template A',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )
      await createTemplate(
        'Template B',
        { type: 'weekly', interval: 1 },
        '2026-04-02',
      )

      const res = await app.request('/api/recurring-task-templates')

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse[]>(res)
      expect(body.map((t) => t.title).toSorted()).toEqual([
        'Template A',
        'Template B',
      ])
    })

    it('filters by context', async () => {
      await createTemplate(
        'Work template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        { context: 'work' },
      )
      await createTemplate(
        'Personal template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )

      const res = await app.request(
        '/api/recurring-task-templates?context=work',
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse[]>(res)
      expect(body.map((t) => t.title)).toEqual(['Work template'])
    })

    it('filters by enabled', async () => {
      await createTemplate(
        'Disabled template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        { enabled: false },
      )
      await createTemplate(
        'Enabled template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )

      const res = await app.request(
        '/api/recurring-task-templates?enabled=false',
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse[]>(res)
      expect(body.map((t) => t.title)).toEqual(['Disabled template'])
    })
  })

  describe('GET /api/recurring-task-templates/:id', () => {
    it('returns a template with its labels and recurrenceRule', async () => {
      const created = await createTemplate(
        'Template with labels',
        { type: 'monthly', interval: 1, dayOfMonth: 15 },
        '2026-04-01',
        { labels: ['label-a', 'label-b'] },
      )

      const res = await app.request(
        `/api/recurring-task-templates/${created.id}`,
      )

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual(normalizeTemplate(created))
    })

    it('returns 404 for a non-existent id', async () => {
      const res = await app.request(
        `/api/recurring-task-templates/${TEST_UUID}`,
      )

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/recurring-task-templates/:id', () => {
    it('updates plain fields', async () => {
      const created = await createTemplate(
        'Original title',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        { description: 'Original description', estimatedMinutes: 30 },
      )

      const res = await patchTemplate(created.id, {
        title: 'Updated title',
        description: 'Updated description',
        estimatedMinutes: 60,
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        title: 'Updated title',
        description: 'Updated description',
        estimatedMinutes: 60,
      })
    })

    it('updates the recurrence rule in place, keeping the same recurrenceRuleId', async () => {
      const created = await createTemplate(
        'Recurring template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )

      const res = await patchTemplate(created.id, {
        recurrenceRule: { type: 'weekly', interval: 2, daysOfWeek: [1, 3] },
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(body.recurrenceRuleId).toBe(created.recurrenceRuleId)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        recurrenceRule: {
          id: 'RULE_ID',
          type: 'weekly',
          interval: 2,
          daysOfWeek: [1, 3],
          dayOfMonth: null,
        },
      })
    })

    it('replaces labels', async () => {
      const created = await createTemplate(
        'Labeled template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        { labels: ['label-a'] },
      )

      const res = await patchTemplate(created.id, { labels: ['label-b'] })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        labels: ['label-b'],
      })
    })

    it('clears nullable fields to null', async () => {
      const project = await createProject('Some project')
      const parent = await createTask('Parent task')
      const created = await createTemplate(
        'Template with optional fields',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        {
          description: 'Some description',
          estimatedMinutes: 30,
          projectId: project.id,
          parentId: parent.id,
          startOffsetDays: 2,
        },
      )

      const res = await patchTemplate(created.id, {
        description: null,
        estimatedMinutes: null,
        projectId: null,
        parentId: null,
        startOffsetDays: null,
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        description: null,
        estimatedMinutes: null,
        projectId: null,
        parentId: null,
        startOffsetDays: null,
      })
    })

    it('returns 404 for a non-existent id', async () => {
      const res = await patchTemplate(TEST_UUID, { title: 'Updated' })

      expect(res.status).toBe(404)
    })

    it('toggles enabled false then true, independent of delete', async () => {
      const created = await createTemplate(
        'Toggle template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )
      expect(created.enabled).toBe(true)

      const disabledRes = await patchTemplate(created.id, { enabled: false })
      expect(disabledRes.status).toBe(200)
      expect((await jsonBody<TemplateResponse>(disabledRes)).enabled).toBe(
        false,
      )

      const enabledRes = await patchTemplate(created.id, { enabled: true })
      expect(enabledRes.status).toBe(200)
      expect((await jsonBody<TemplateResponse>(enabledRes)).enabled).toBe(true)

      const getRes = await app.request(
        `/api/recurring-task-templates/${created.id}`,
      )
      expect(getRes.status).toBe(200)
    })
  })

  describe('DELETE /api/recurring-task-templates/:id', () => {
    it('deletes the template and its exclusively-owned recurrence rule', async () => {
      const created = await createTemplate(
        'To delete',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )

      const res = await app.request(
        `/api/recurring-task-templates/${created.id}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(204)
      const templateRows = await db
        .select()
        .from(recurringTaskTemplates)
        .where(eq(recurringTaskTemplates.id, created.id))
      const ruleRows = await db
        .select()
        .from(recurrenceRules)
        .where(eq(recurrenceRules.id, created.recurrenceRuleId))
      expect(templateRows).toEqual([])
      expect(ruleRows).toEqual([])
    })

    it('returns 404 for a non-existent id', async () => {
      const res = await app.request(
        `/api/recurring-task-templates/${TEST_UUID}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(404)
    })
  })
})

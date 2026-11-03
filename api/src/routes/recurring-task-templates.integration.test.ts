import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import {
  edits,
  projects,
  recurrenceRules,
  recurringTaskTemplates,
  tasks,
} from '#db/schema'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import { createTask, TEST_UUID } from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
})

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

function postOccurrence(id: string, occurrenceDate: string, author = 'human') {
  return app.request(`/api/recurring-task-templates/${id}/occurrences`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Author': author,
    },
    body: JSON.stringify({ occurrenceDate }),
  })
}

function normalizeOccurrenceResponse(response: Record<string, unknown>) {
  return {
    ...response,
    id: 'ID',
    number: 0,
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
  }
}

function expectedOccurrenceResponse(overrides: Record<string, unknown>) {
  return {
    id: 'ID',
    number: 0,
    title: 'Occurrence title',
    description: null,
    status: 'todo',
    statusReason: null,
    context: 'personal',
    priority: null,
    commitment: 'inbox',
    labels: [],
    startDate: null,
    dueDate: '2031-04-11',
    remindAt: null,
    parentId: null,
    projectId: null,
    recurrenceRuleId: null,
    recurrenceRule: null,
    templateId: 'TEMPLATE_ID',
    occurrenceDate: '2031-04-11',
    githubLinks: [],
    createdAt: 'TIMESTAMP',
    updatedAt: 'TIMESTAMP',
    ...overrides,
  }
}

function responseWithStatus<T>(status: number, body: T) {
  return { status, body }
}

function occurrenceResponseWithEvents(
  status: number,
  body: Record<string, unknown>,
  events: ChangeEvent[],
) {
  return {
    status,
    body: normalizeOccurrenceResponse(body),
    events,
  }
}

function duplicateOccurrenceOutcome(
  firstStatus: number,
  duplicateStatus: number,
  body: unknown,
) {
  return { firstStatus, duplicateStatus, body }
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

// `labels` order isn't guaranteed, so it's sorted before comparing.
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

  describe('POST /api/recurring-task-templates/:id/occurrences', () => {
    it('creates a task from the template for a date outside its recurrence rule', async () => {
      const template = await createTemplate(
        'Catch-up {date}',
        { type: 'monthly', interval: 1, dayOfMonth: 1 },
        '2031-04-01',
        {
          description: 'Review the previous cycle',
          context: 'work',
          labels: ['release'],
          startOffsetDays: 3,
        },
      )

      const res = await postOccurrence(template.id, '2031-04-11')
      const body = await jsonBody<Record<string, unknown>>(res)

      expect(
        responseWithStatus(res.status, normalizeOccurrenceResponse(body)),
      ).toEqual({
        status: 201,
        body: expectedOccurrenceResponse({
          title: 'Catch-up 2031-04-11',
          description: 'Review the previous cycle',
          context: 'work',
          labels: ['release'],
          startDate: '2031-04-08',
          dueDate: '2031-04-11',
          templateId: template.id,
          occurrenceDate: '2031-04-11',
        }),
      })
    })

    it('records the author of the request in the edit history', async () => {
      const template = await createTemplate(
        'Authored occurrence',
        { type: 'daily', interval: 1 },
        '2031-04-01',
      )
      const res = await postOccurrence(
        template.id,
        '2031-04-11',
        'llm:occurrence-test-agent',
      )
      const body = await jsonBody<Record<string, unknown>>(res)
      const taskId = String(body['id'])
      const history = await db
        .select({
          action: edits.action,
          authorKind: edits.authorKind,
          authorAgent: edits.authorAgent,
        })
        .from(edits)
        .where(eq(edits.taskId, taskId))

      expect(responseWithStatus(res.status, history)).toEqual({
        status: 201,
        body: [
          {
            action: 'create',
            authorKind: 'llm',
            authorAgent: 'occurrence-test-agent',
          },
        ],
      })
    })

    it('does not advance lastGeneratedDate', async () => {
      const template = await createTemplate(
        'Cursor occurrence',
        { type: 'daily', interval: 1 },
        '2031-04-01',
      )
      await db
        .update(recurringTaskTemplates)
        .set({ lastGeneratedDate: '2031-04-08' })
        .where(eq(recurringTaskTemplates.id, template.id))

      const res = await postOccurrence(template.id, '2031-04-11')
      const [storedTemplate] = await db
        .select({ lastGeneratedDate: recurringTaskTemplates.lastGeneratedDate })
        .from(recurringTaskTemplates)
        .where(eq(recurringTaskTemplates.id, template.id))

      expect(
        responseWithStatus(res.status, storedTemplate?.lastGeneratedDate),
      ).toEqual({
        status: 201,
        body: '2031-04-08',
      })
    })

    it('includes a parent task in the change event', async () => {
      const project = await createProject('Occurrence project')
      const parent = await createTask('Parent task')
      const template = await createTemplate(
        'Child occurrence',
        { type: 'daily', interval: 1 },
        '2031-04-01',
        { parentId: parent.id, projectId: project.id },
      )
      const events: ChangeEvent[] = []
      stopWatchingChanges = subscribeToChangeEvents((event) =>
        events.push(event),
      )

      const res = await postOccurrence(template.id, '2031-04-11')
      const body = await jsonBody<Record<string, unknown>>(res)
      const taskId = String(body['id'])

      expect(occurrenceResponseWithEvents(res.status, body, events)).toEqual({
        status: 201,
        body: expectedOccurrenceResponse({
          title: 'Child occurrence',
          dueDate: '2031-04-11',
          parentId: parent.id,
          projectId: project.id,
          templateId: template.id,
          occurrenceDate: '2031-04-11',
        }),
        events: [
          {
            resource: 'task',
            id: taskId,
            origin: null,
            taskIds: [taskId, parent.id],
          },
          {
            resource: 'recurring_task_template',
            id: template.id,
            origin: null,
            taskIds: null,
          },
        ],
      })
    })

    it('creates an occurrence from a disabled template', async () => {
      const template = await createTemplate(
        'Disabled occurrence',
        { type: 'daily', interval: 1 },
        '2031-04-01',
        { enabled: false },
      )
      const res = await postOccurrence(template.id, '2025-01-03')
      const body = await jsonBody<Record<string, unknown>>(res)

      expect(
        responseWithStatus(res.status, normalizeOccurrenceResponse(body)),
      ).toEqual({
        status: 201,
        body: expectedOccurrenceResponse({
          title: 'Disabled occurrence',
          dueDate: '2025-01-03',
          templateId: template.id,
          occurrenceDate: '2025-01-03',
        }),
      })
    })

    it('returns 400 for a date that is not a valid YYYY-MM-DD date', async () => {
      const template = await createTemplate(
        'Date validation',
        { type: 'daily', interval: 1 },
        '2031-04-01',
      )
      const res = await postOccurrence(template.id, '2031-02-30')
      const existingTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.templateId, template.id))

      expect(responseWithStatus(res.status, existingTasks)).toEqual({
        status: 400,
        body: [],
      })
    })

    it('returns 404 when the template does not exist', async () => {
      const res = await postOccurrence(TEST_UUID, '2031-04-11')

      expect(responseWithStatus(res.status, await res.json())).toEqual({
        status: 404,
        body: { error: 'Recurring task template not found' },
      })
    })

    it('returns 409 when the same occurrence already exists', async () => {
      const template = await createTemplate(
        'Duplicate occurrence',
        { type: 'daily', interval: 1 },
        '2031-04-01',
      )
      const first = await postOccurrence(template.id, '2031-04-11')
      const duplicate = await postOccurrence(template.id, '2031-04-11')

      expect(
        duplicateOccurrenceOutcome(
          first.status,
          duplicate.status,
          await duplicate.json(),
        ),
      ).toEqual({
        firstStatus: 201,
        duplicateStatus: 409,
        body: { error: 'Recurring task occurrence already exists' },
      })
    })
  })

  describe('PATCH /api/recurring-task-templates/:id', () => {
    it('updates plain fields', async () => {
      const created = await createTemplate(
        'Original title',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        { description: 'Original description' },
      )

      const res = await patchTemplate(created.id, {
        title: 'Updated title',
        description: 'Updated description',
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        title: 'Updated title',
        description: 'Updated description',
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
          projectId: project.id,
          parentId: parent.id,
          startOffsetDays: 2,
        },
      )

      const res = await patchTemplate(created.id, {
        description: null,
        projectId: null,
        parentId: null,
        startOffsetDays: null,
      })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        description: null,
        projectId: null,
        parentId: null,
        startOffsetDays: null,
      })
    })

    it('returns 404 for a non-existent id', async () => {
      const res = await patchTemplate(TEST_UUID, { title: 'Updated' })

      expect(res.status).toBe(404)
    })

    it('disables the template', async () => {
      const created = await createTemplate(
        'Toggle template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )

      const res = await patchTemplate(created.id, { enabled: false })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        enabled: false,
      })
    })

    it('re-enables a disabled template', async () => {
      const created = await createTemplate(
        'Toggle template',
        { type: 'daily', interval: 1 },
        '2026-04-01',
        { enabled: false },
      )

      const res = await patchTemplate(created.id, { enabled: true })

      expect(res.status).toBe(200)
      const body = await jsonBody<TemplateResponse>(res)
      expect(normalizeTemplate(body)).toEqual({
        ...normalizeTemplate(created),
        enabled: true,
      })
    })

    it('returns 404 for a non-existent parentId', async () => {
      const created = await createTemplate(
        'Template to reparent',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )

      const res = await patchTemplate(created.id, { parentId: TEST_UUID })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/recurring-task-templates/:id', () => {
    it('detaches generated tasks when deleting the template', async () => {
      const created = await createTemplate(
        'To delete',
        { type: 'daily', interval: 1 },
        '2026-04-01',
      )
      const generatedTask = firstOrThrow(
        await db
          .insert(tasks)
          .values({
            title: 'Generated task',
            templateId: created.id,
            occurrenceDate: '2026-04-01',
          })
          .returning(),
      )

      const res = await app.request(
        `/api/recurring-task-templates/${created.id}`,
        { method: 'DELETE' },
      )

      expect(res.status).toBe(204)
      const taskRows = await db
        .select()
        .from(tasks)
        .where(eq(tasks.id, generatedTask.id))
      expect(taskRows).toEqual([
        { ...generatedTask, templateId: null, occurrenceDate: null },
      ])
    })

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

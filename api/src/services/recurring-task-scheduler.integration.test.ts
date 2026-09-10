import { asc, eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import {
  labels,
  recurrenceRules,
  recurringTaskTemplates,
  taskLabels,
  tasks,
} from '#db/schema'
import { firstOrThrow } from '#lib/drizzle-utils'
import { generateDueRecurringTasks } from '#services/recurring-task-scheduler'
import { syncTemplateLabels } from '#services/recurring-task-template-labels'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.useRealTimers()
})

interface RuleInput {
  type: 'daily' | 'weekly' | 'monthly' | 'custom'
  interval: number
  daysOfWeek?: number[] | null
  dayOfMonth?: number | null
}

async function createTemplate(
  rule: RuleInput,
  overrides: Partial<typeof recurringTaskTemplates.$inferInsert> = {},
  labelNames: string[] = [],
) {
  return db.transaction(async (tx) => {
    const insertedRule = firstOrThrow(
      await tx.insert(recurrenceRules).values(rule).returning(),
    )
    const template = firstOrThrow(
      await tx
        .insert(recurringTaskTemplates)
        .values({
          title: 'Recurring template',
          anchorDate: '2026-03-01',
          ...overrides,
          recurrenceRuleId: insertedRule.id,
        })
        .returning(),
    )
    if (labelNames.length > 0) {
      await syncTemplateLabels(tx, template.id, labelNames, template.context)
    }
    return template
  })
}

function normalizeTask(task: typeof tasks.$inferSelect) {
  return { ...task, id: 'ID', number: 0, createdAt: 'DATE', updatedAt: 'DATE' }
}

// Builds the expected shape of a task generated from `template`, copying the
// fields the scheduler always copies verbatim so each test only has to spell
// out the fields it's actually exercising.
function expectedTask(
  template: typeof recurringTaskTemplates.$inferSelect,
  overrides: Partial<ReturnType<typeof normalizeTask>>,
) {
  return {
    id: 'ID',
    number: 0,
    title: template.title,
    description: template.description,
    status: 'todo' as const,
    statusReason: null,
    startDate: null,
    dueDate: null,
    estimatedMinutes: template.estimatedMinutes,
    parentId: template.parentId,
    projectId: template.projectId,
    recurrenceRuleId: null,
    templateId: template.id,
    occurrenceDate: null,
    context: template.context,
    commitment: 'inbox' as const,
    remindAt: null,
    createdAt: 'DATE',
    updatedAt: 'DATE',
    ...overrides,
  }
}

async function rawTasksForTemplate(templateId: string) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.templateId, templateId))
    .orderBy(asc(tasks.occurrenceDate))
}

async function tasksForTemplate(templateId: string) {
  return (await rawTasksForTemplate(templateId)).map(normalizeTask)
}

async function templateLastGeneratedDate(templateId: string) {
  const row = firstOrThrow(
    await db
      .select({ lastGeneratedDate: recurringTaskTemplates.lastGeneratedDate })
      .from(recurringTaskTemplates)
      .where(eq(recurringTaskTemplates.id, templateId)),
  )
  return row.lastGeneratedDate
}

async function outcome(templateId: string) {
  return {
    tasks: await tasksForTemplate(templateId),
    lastGeneratedDate: await templateLastGeneratedDate(templateId),
  }
}

async function taskLabelNames(taskId: string) {
  const rows = await db
    .select({ name: labels.name })
    .from(taskLabels)
    .innerJoin(labels, eq(taskLabels.labelId, labels.id))
    .where(eq(taskLabels.taskId, taskId))
  return rows.map((row) => row.name).toSorted()
}

// Only `Date` is faked (not timers): the DB driver relies on real timers for
// its socket I/O, and faking those would hang every query indefinitely.
function fakeToday(date: string) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date(`${date}T12:00:00Z`))
}

describe('generateDueRecurringTasks', () => {
  it('generates a task when an occurrence is due', async () => {
    fakeToday('2026-03-23')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-22' },
    )

    await generateDueRecurringTasks()

    expect(await outcome(template.id)).toEqual({
      tasks: [
        expectedTask(template, {
          dueDate: '2026-03-23',
          occurrenceDate: '2026-03-23',
        }),
      ],
      lastGeneratedDate: '2026-03-23',
    })
  })

  it('creates nothing when no occurrence is due yet', async () => {
    fakeToday('2026-03-23')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-23' },
    )

    await generateDueRecurringTasks()

    expect(await outcome(template.id)).toEqual({
      tasks: [],
      lastGeneratedDate: null,
    })
  })

  it('catches up every missed occurrence in a single call', async () => {
    fakeToday('2026-03-26')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-01', lastGeneratedDate: '2026-03-22' },
    )

    await generateDueRecurringTasks()

    expect(await outcome(template.id)).toEqual({
      tasks: [
        expectedTask(template, {
          dueDate: '2026-03-23',
          occurrenceDate: '2026-03-23',
        }),
        expectedTask(template, {
          dueDate: '2026-03-24',
          occurrenceDate: '2026-03-24',
        }),
        expectedTask(template, {
          dueDate: '2026-03-25',
          occurrenceDate: '2026-03-25',
        }),
        expectedTask(template, {
          dueDate: '2026-03-26',
          occurrenceDate: '2026-03-26',
        }),
      ],
      lastGeneratedDate: '2026-03-26',
    })
  })

  it('never double-generates when the tick runs twice for the same day', async () => {
    fakeToday('2026-03-23')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-22' },
    )
    const expected = {
      tasks: [
        expectedTask(template, {
          dueDate: '2026-03-23',
          occurrenceDate: '2026-03-23',
        }),
      ],
      lastGeneratedDate: '2026-03-23',
    }

    await generateDueRecurringTasks()
    expect(await outcome(template.id)).toEqual(expected)

    await generateDueRecurringTasks()
    expect(await outcome(template.id)).toEqual(expected)
  })

  it('skips a disabled template even with a due occurrence', async () => {
    fakeToday('2026-03-23')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-22', enabled: false },
    )

    await generateDueRecurringTasks()

    expect(await outcome(template.id)).toEqual({
      tasks: [],
      lastGeneratedDate: null,
    })
  })

  it("copies the template's labels onto the generated task", async () => {
    fakeToday('2026-03-23')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-22' },
      ['focus', 'urgent'],
    )

    await generateDueRecurringTasks()

    const task = firstOrThrow(await rawTasksForTemplate(template.id))
    expect(await taskLabelNames(task.id)).toEqual(['focus', 'urgent'])
  })

  it('derives startDate from startOffsetDays', async () => {
    fakeToday('2026-03-23')
    const template = await createTemplate(
      { type: 'daily', interval: 1 },
      { anchorDate: '2026-03-22', startOffsetDays: 2 },
    )

    await generateDueRecurringTasks()

    expect(await outcome(template.id)).toEqual({
      tasks: [
        expectedTask(template, {
          dueDate: '2026-03-23',
          occurrenceDate: '2026-03-23',
          startDate: '2026-03-21',
        }),
      ],
      lastGeneratedDate: '2026-03-23',
    })
  })
})

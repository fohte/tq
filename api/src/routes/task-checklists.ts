import { zValidator } from '@hono/zod-validator'
import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import {
  createChecklistItemSchema,
  createChecklistSchema,
} from '#schemas/task-checklist'
import { createTaskChecklist } from '#services/task-checklist-ordering'
import { createChecklistItem } from '#services/task-checklists'

type ChecklistItemRow = typeof taskChecklistItems.$inferSelect
type ChecklistItemTree = ReturnType<typeof checklistItemToResponse> & {
  children: ChecklistItemTree[]
}

function checklistItemToResponse(item: ChecklistItemRow) {
  return {
    id: item.id,
    checklistId: item.checklistId,
    parentItemId: item.parentItemId,
    content: item.content,
    note: item.note,
    checkedAt: item.checkedAt?.toISOString() ?? null,
    sortOrder: item.sortOrder,
    githubLinkId: item.githubLinkId,
    subtaskId: item.subtaskId,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

function checklistItemTree(rows: ChecklistItemRow[]): ChecklistItemTree[] {
  const nodes = new Map<string, ChecklistItemTree>()
  for (const row of rows) {
    nodes.set(row.id, { ...checklistItemToResponse(row), children: [] })
  }

  const roots: ChecklistItemTree[] = []
  for (const row of rows) {
    const node = nodes.get(row.id)
    if (node == null) continue

    const parent =
      row.parentItemId == null ? undefined : nodes.get(row.parentItemId)
    if (parent == null) roots.push(node)
    else parent.children.push(node)
  }
  return roots
}

export const taskChecklistsApp = new Hono<TaskEnv>()
  .use('*', async (c, next) => {
    const taskParam = c.req.param('taskId')
    if (taskParam == null) {
      return c.json({ error: 'taskId is required' }, 400)
    }

    const task = await findTaskByIdOrNumber(taskParam)
    if (!task) return c.json({ error: 'Task not found' }, 404)

    c.set('task', task)
    return next()
  })
  .get('/', async (c) => {
    const taskId = c.get('task').id
    const checklists = await db
      .select()
      .from(taskChecklists)
      .where(eq(taskChecklists.taskId, taskId))
      .orderBy(
        asc(taskChecklists.sortOrder),
        asc(taskChecklists.createdAt),
        asc(taskChecklists.id),
      )

    const items =
      checklists.length === 0
        ? []
        : await db
            .select()
            .from(taskChecklistItems)
            .where(
              inArray(
                taskChecklistItems.checklistId,
                checklists.map((checklist) => checklist.id),
              ),
            )
            .orderBy(
              asc(taskChecklistItems.sortOrder),
              asc(taskChecklistItems.createdAt),
              asc(taskChecklistItems.id),
            )

    return c.json(
      checklists.map((checklist) => ({
        id: checklist.id,
        taskId: checklist.taskId,
        name: checklist.name,
        sortOrder: checklist.sortOrder,
        createdAt: checklist.createdAt.toISOString(),
        updatedAt: checklist.updatedAt.toISOString(),
        items: checklistItemTree(
          items.filter((item) => item.checklistId === checklist.id),
        ),
      })),
      200,
    )
  })
  .post('/', zValidator('json', createChecklistSchema), async (c) => {
    const taskId = c.get('task').id
    const input = c.req.valid('json')
    const checklist = await db.transaction((tx) =>
      createTaskChecklist(tx, taskId, input),
    )

    if (!checklist) return c.json({ error: 'Task not found' }, 404)
    return c.json(
      {
        id: checklist.id,
        taskId: checklist.taskId,
        name: checklist.name,
        sortOrder: checklist.sortOrder,
        createdAt: checklist.createdAt.toISOString(),
        updatedAt: checklist.updatedAt.toISOString(),
        items: [],
      },
      201,
    )
  })

export const checklistItemsApp = new Hono().post(
  '/:checklistId/items',
  zValidator('json', createChecklistItemSchema),
  async (c) => {
    const checklistId = c.req.param('checklistId')
    const result = await db.transaction((tx) =>
      createChecklistItem(tx, checklistId, c.req.valid('json')),
    )

    return result.match(
      (item) => c.json(checklistItemToResponse(item), 201),
      (error) => c.json({ error: error.message }, error.status),
    )
  },
)

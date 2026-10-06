import { zValidator } from '@hono/zod-validator'
import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { taskChecklistItems, taskChecklists } from '#db/schema'
import {
  checklistItemTree,
  checklistToResponse,
} from '#routes/checklist-response'
import { findTaskByIdOrNumber, type TaskEnv } from '#routes/tasks/shared'
import { createChecklistSchema } from '#schemas/task-checklist'
import { createTaskChecklist } from '#services/task-checklists'

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
      checklists.map((checklist) =>
        checklistToResponse(
          checklist,
          checklistItemTree(
            items.filter((item) => item.checklistId === checklist.id),
          ),
        ),
      ),
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
    return c.json(checklistToResponse(checklist, []), 201)
  })

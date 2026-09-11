import { count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { recurrenceRules, taskPages, tasks, timeBlocks } from '#db/schema'
import { getPageAuthors, getTaskFieldAuthors } from '#lib/edits'
import { pageToResponse } from '#routes/task-pages'
import {
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  requireTask,
  taskToResponse,
  timeBlockToResponse,
} from '#routes/tasks/shared'
import { getTaskLinks } from '#services/task-links'
import {
  getDuplicateOfNumbersByTaskId,
  getDuplicateOfTask,
  getTaskBlockedByRelations,
} from '#services/task-relations'

export const tasksDetailApp = new Hono().get('/:id', requireTask, async (c) => {
  const task = c.get('task')
  const id = task.id
  const templateId = task.templateId

  const [
    childStats,
    parentTask,
    pages,
    taskTimeBlocks,
    rule,
    githubLinksByTaskId,
    links,
    taskFieldAuthors,
    labelsByTaskId,
    duplicateOfNumbersByTaskId,
    duplicateOfTask,
    blockedByRelations,
  ] = await Promise.all([
    db
      .select({
        total: count(),
        completed: count(
          sql`CASE WHEN ${tasks.status} = 'completed' THEN 1 END`,
        ),
      })
      .from(tasks)
      .where(eq(tasks.parentId, id)),
    task.parentId != null
      ? db.query.tasks.findFirst({
          where: eq(tasks.id, task.parentId),
          columns: { number: true },
        })
      : Promise.resolve(null),
    db
      .select()
      .from(taskPages)
      .where(eq(taskPages.taskId, id))
      .orderBy(taskPages.sortOrder, taskPages.createdAt),
    db
      .select()
      .from(timeBlocks)
      .where(eq(timeBlocks.taskId, id))
      .orderBy(timeBlocks.startTime),
    templateId != null
      ? getRecurrenceRulesByTemplateIds([templateId]).then(
          (rulesByTemplateId) => rulesByTemplateId.get(templateId) ?? null,
        )
      : task.recurrenceRuleId != null
        ? db.query.recurrenceRules.findFirst({
            where: eq(recurrenceRules.id, task.recurrenceRuleId),
          })
        : Promise.resolve(null),
    getGithubLinksByTaskId([id]),
    getTaskLinks(id),
    getTaskFieldAuthors(id),
    getLabelNamesByTaskId([id]),
    getDuplicateOfNumbersByTaskId([id]),
    getDuplicateOfTask(id),
    getTaskBlockedByRelations(id),
  ])

  const pageAuthors = await getPageAuthors(pages.map((page) => page.id))

  return c.json(
    {
      ...taskToResponse(
        task,
        rule,
        githubLinksByTaskId.get(id) ?? [],
        labelsByTaskId.get(id) ?? [],
      ),
      titleAuthor: taskFieldAuthors.title,
      descriptionAuthor: taskFieldAuthors.description,
      parentNumber: parentTask?.number ?? null,
      childCompletionCount: {
        total: childStats[0]?.total ?? 0,
        completed: childStats[0]?.completed ?? 0,
      },
      pages: pages.map((page) =>
        pageToResponse(page, pageAuthors.get(page.id) ?? null),
      ),
      timeBlocks: taskTimeBlocks.map(timeBlockToResponse),
      links,
      labels: labelsByTaskId.get(id) ?? [],
      duplicateOfNumber:
        task.statusReason === 'duplicate'
          ? (duplicateOfNumbersByTaskId.get(id) ?? null)
          : null,
      duplicateOfTask:
        task.statusReason === 'duplicate' ? duplicateOfTask : null,
      blockedBy: blockedByRelations.blockedBy,
      blocking: blockedByRelations.blocking,
    },
    200,
  )
})

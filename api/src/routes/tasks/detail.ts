import { count, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'

import { db } from '#db/connection'
import { recurrenceRules, taskPages, tasks, timeBlocks } from '#db/schema'
import { getPageAuthors, getTaskFieldAuthors } from '#lib/edits'
import { pageToListResponse, taskPageListSelection } from '#routes/task-pages'
import { getTaskChecklistData } from '#routes/tasks/checklist-data'
import {
  getGithubLinksByTaskId,
  getLabelNamesByTaskId,
  getRecurrenceRulesByTemplateIds,
  githubLinkToResponse,
  hydrateTaskListRows,
  requireTask,
  taskToResponse,
  timeBlockToResponse,
} from '#routes/tasks/shared'
import { getTaskGithubBlockers } from '#services/task-github-blockers'
import { getTaskLinkRows } from '#services/task-links'
import {
  getDuplicateOfTaskRow,
  getTaskBlockedByRelationRows,
} from '#services/task-relations'

export const tasksDetailApp = new Hono().get('/:id', requireTask, async (c) => {
  const task = c.get('task')
  const id = task.id
  const templateId = task.templateId

  const relatedTasksPromise = Promise.all([
    getTaskLinkRows(id),
    task.statusReason === 'duplicate'
      ? getDuplicateOfTaskRow(id)
      : Promise.resolve(null),
    getTaskBlockedByRelationRows(id),
  ]).then(async ([taskLinkRows, duplicateOfTaskRow, blockedByRows]) => {
    const hydratedRows = await hydrateTaskListRows([
      ...taskLinkRows.outgoing,
      ...taskLinkRows.incoming,
      ...(duplicateOfTaskRow == null ? [] : [duplicateOfTaskRow]),
      ...blockedByRows.blockedBy,
      ...blockedByRows.blocking,
    ])
    let offset = 0
    const takeRows = (count: number) => {
      const rows = hydratedRows.slice(offset, offset + count)
      offset += count
      return rows
    }

    const outgoing = takeRows(taskLinkRows.outgoing.length)
    const incoming = takeRows(taskLinkRows.incoming.length)
    const duplicateOfTask =
      duplicateOfTaskRow == null ? null : (takeRows(1)[0] ?? null)
    const blockedBy = takeRows(blockedByRows.blockedBy.length)
    const blocking = takeRows(blockedByRows.blocking.length)

    return {
      links: { outgoing, incoming },
      duplicateOfTask,
      blockedBy,
      blocking,
    }
  })

  const [
    childStats,
    parentTask,
    pages,
    taskTimeBlocks,
    rule,
    githubLinksByTaskId,
    taskFieldAuthors,
    labelsByTaskId,
    githubBlockers,
    checklistData,
    relatedTasks,
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
      .select(taskPageListSelection())
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
    getGithubLinksByTaskId([id], { role: 'subject' }),
    getTaskFieldAuthors(id),
    getLabelNamesByTaskId([id]),
    getTaskGithubBlockers(id),
    getTaskChecklistData(id),
    relatedTasksPromise,
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
        pageToListResponse(page, pageAuthors.get(page.id) ?? null),
      ),
      timeBlocks: taskTimeBlocks.map(timeBlockToResponse),
      links: relatedTasks.links,
      labels: labelsByTaskId.get(id) ?? [],
      duplicateOfNumber: relatedTasks.duplicateOfTask?.number ?? null,
      duplicateOfTask: relatedTasks.duplicateOfTask,
      blockedBy: relatedTasks.blockedBy,
      blocking: relatedTasks.blocking,
      githubBlockers: githubBlockers.map(githubLinkToResponse),
      ...checklistData,
    },
    200,
  )
})

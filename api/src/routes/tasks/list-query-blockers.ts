import { and, eq, exists, ne, notExists, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from '#db/connection'
import { taskGithubLinks, taskRelations, tasks } from '#db/schema'
import { unresolvedTaskWaitSubquery } from '#routes/tasks/list-query-waits'

const blockerTasks = alias(tasks, 'blocker_task')

function unresolvedTaskBlockerSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskRelations)
    .innerJoin(blockerTasks, eq(blockerTasks.id, taskRelations.targetTaskId))
    .where(
      and(
        eq(taskRelations.sourceTaskId, tasks.id),
        eq(taskRelations.type, 'blocked_by'),
        ne(blockerTasks.status, 'completed'),
      ),
    )
}

function unresolvedGithubBlockerSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskGithubLinks)
    .where(
      and(
        eq(taskGithubLinks.taskId, tasks.id),
        eq(taskGithubLinks.role, 'blocker'),
        eq(taskGithubLinks.state, 'open'),
      ),
    )
}

export function unresolvedBlockerCondition() {
  return or(
    exists(unresolvedTaskBlockerSubquery()),
    exists(unresolvedGithubBlockerSubquery()),
    exists(unresolvedTaskWaitSubquery()),
  )
}

export function noUnresolvedBlockerCondition() {
  return and(
    notExists(unresolvedTaskBlockerSubquery()),
    notExists(unresolvedGithubBlockerSubquery()),
    notExists(unresolvedTaskWaitSubquery()),
  )
}

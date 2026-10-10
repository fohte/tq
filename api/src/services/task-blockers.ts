import { and, eq, exists, isNull, ne, not, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'

import { db } from '#db/connection'
import { taskGithubLinks, taskRelations, tasks, taskWaits } from '#db/schema'

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

function unresolvedTaskWaitSubquery() {
  return db
    .select({ _: sql`1` })
    .from(taskWaits)
    .where(and(eq(taskWaits.taskId, tasks.id), isNull(taskWaits.resolvedAt)))
}

export function hasUnresolvedBlockersCondition() {
  return sql`(${exists(unresolvedTaskBlockerSubquery())} OR ${exists(unresolvedGithubBlockerSubquery())} OR ${exists(unresolvedTaskWaitSubquery())})`
}

export function hasNoUnresolvedBlockersCondition() {
  return not(hasUnresolvedBlockersCondition())
}

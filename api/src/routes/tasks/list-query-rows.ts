import { eq, getTableColumns } from 'drizzle-orm'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { parentTasks } from '#routes/tasks/shared'

export function selectTaskListRows() {
  return db
    .select({
      task: tasks,
      parentNumber: parentTasks.number,
    })
    .from(tasks)
    .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
}

const { description: taskDescriptionColumn, ...taskRowColumns } =
  getTableColumns(tasks)
void taskDescriptionColumn

export function selectTaskListRowsWithoutDescription() {
  return db
    .select({
      task: taskRowColumns,
      parentNumber: parentTasks.number,
    })
    .from(tasks)
    .leftJoin(parentTasks, eq(parentTasks.id, tasks.parentId))
}

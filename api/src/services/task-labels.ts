import { eq, inArray } from 'drizzle-orm'

import type { DbTransaction } from '#db/connection'
import { labels, taskLabels } from '#db/schema'

// Full replacement, not add/remove: callers must pass the complete desired
// set of names each time, so an empty array clears every label from the task.
export async function syncTaskLabels(
  tx: DbTransaction,
  taskId: string,
  names: string[],
): Promise<string[]> {
  const uniqueNames = [...new Set(names)]

  await tx.delete(taskLabels).where(eq(taskLabels.taskId, taskId))
  if (uniqueNames.length === 0) return []

  await tx
    .insert(labels)
    .values(uniqueNames.map((name) => ({ name })))
    .onConflictDoNothing({ target: labels.name })

  const rows = await tx
    .select()
    .from(labels)
    .where(inArray(labels.name, uniqueNames))

  await tx
    .insert(taskLabels)
    .values(rows.map((label) => ({ taskId, labelId: label.id })))
    .onConflictDoNothing({ target: [taskLabels.taskId, taskLabels.labelId] })

  return rows.map((label) => label.name)
}

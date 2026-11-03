import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { db } from '#db/connection'
import { tasks } from '#db/schema'
import { createTask } from '#routes/tasks/testing'
import { setupTestDb } from '#testing'

setupTestDb()

async function sqlStateFor(operation: Promise<unknown>) {
  return operation.then(
    () => 'accepted',
    (error: unknown) => {
      const cause = error instanceof Error ? error.cause : error
      if (
        cause == null ||
        typeof cause !== 'object' ||
        !('code' in cause) ||
        typeof cause.code !== 'string'
      ) {
        return 'unknown'
      }
      return cause.code
    },
  )
}

describe('task priority database constraint', () => {
  it.each([-2, 3])('rejects priority %i', async (priority) => {
    const task = await createTask('Priority boundary task')
    const sqlState = await sqlStateFor(
      db.update(tasks).set({ priority }).where(eq(tasks.id, task.id)),
    )

    expect(sqlState).toEqual('23514')
  })
})

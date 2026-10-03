import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { taskGithubLinks } from '#db/schema'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { createTask } from '#routes/tasks/testing'
import {
  insertTaskGithubBlockers,
  prepareGithubBlockers,
} from '#services/task-github-blockers'
import { syncTaskBlockedBy } from '#services/task-relations'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

describe('task GitHub blockers', () => {
  it('rejects a prepared blocker that disappeared before replacement', async () => {
    const task = await createTask('Blocked task')
    const url = 'https://github.com/example-owner/example-repo/issues/17'
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse({ html_url: url })

    const initiallyPrepared = (
      await prepareGithubBlockers(undefined, [url])
    )._unsafeUnwrap()
    await db.transaction((tx) =>
      insertTaskGithubBlockers(tx, task.id, initiallyPrepared.newIssues),
    )
    const prepared = (
      await prepareGithubBlockers(task.id, [url])
    )._unsafeUnwrap()

    await db.delete(taskGithubLinks).where(eq(taskGithubLinks.taskId, task.id))

    const getActual = async () => ({
      preparedIssueCount: prepared.newIssues.length,
      syncResult: await syncTaskBlockedBy(task.id, [], prepared),
    })
    expect(await getActual()).toEqual({
      preparedIssueCount: 0,
      syncResult: 'github-stale-blocker',
    })
  })
})

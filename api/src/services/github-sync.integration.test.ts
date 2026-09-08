import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { taskGithubLinks, tasks } from '#db/schema'
import {
  mockGithubIssueResponse,
  mockGithubNotModifiedResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { firstOrThrow } from '#lib/drizzle-utils'
import { createTask } from '#routes/tasks/testing'
import { syncAllGithubLinks, syncLinkFromGithub } from '#services/github-sync'
import { createTaskFromGithubUrl } from '#services/task-github-links'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

const ref = { owner: 'fohte', repo: 'tq', number: 42 }

async function loadTask(id: string) {
  return firstOrThrow(await db.select().from(tasks).where(eq(tasks.id, id)))
}

async function loadLink(id: string) {
  return firstOrThrow(
    await db.select().from(taskGithubLinks).where(eq(taskGithubLinks.id, id)),
  )
}

function normalizeTask(task: typeof tasks.$inferSelect) {
  return { ...task, createdAt: 'DATE', updatedAt: 'DATE' }
}

function normalizeLink(link: typeof taskGithubLinks.$inferSelect) {
  return { ...link, lastSyncedAt: 'DATE', createdAt: 'DATE', updatedAt: 'DATE' }
}

async function createLinkedTask(githubRef: typeof ref = ref) {
  await upsertGithubToken('valid-token')
  mockGithubIssueResponse()
  return (await createTaskFromGithubUrl(githubRef))._unsafeUnwrap()
}

describe('syncLinkFromGithub', () => {
  it('updates the link title when GitHub renames the issue, without touching the task', async () => {
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse({ title: 'Renamed on GitHub' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({ ...link, title: 'Renamed on GitHub' }),
    )
  })

  it('updates the link state when GitHub closes the issue, without touching the task status', async () => {
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({ ...link, state: 'closed' }),
    )
  })

  it('never overwrites a task description edited in TQ, even when the GitHub body changes', async () => {
    const { task, link } = await createLinkedTask()
    await db
      .update(tasks)
      .set({ description: 'Edited locally in TQ' })
      .where(eq(tasks.id, task.id))

    mockGithubIssueResponse({ body: 'Updated reproduction steps on GitHub' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect((await loadTask(task.id)).description).toBe('Edited locally in TQ')
  })

  it('leaves the task and link content untouched when nothing changed on GitHub', async () => {
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse()
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(normalizeLink(link))
  })

  it('stores the returned etag when GitHub responds with a fresh 200', async () => {
    const { link } = await createLinkedTask()

    mockGithubIssueResponse({}, { headers: { etag: '"abc123"' } })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({ ...link, etag: '"abc123"' }),
    )
  })

  it('only bumps lastSyncedAt when GitHub reports no change via ETag', async () => {
    const { link } = await createLinkedTask()
    const linkWithEtag = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ etag: '"abc123"' })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    mockGithubNotModifiedResponse()
    ;(await syncLinkFromGithub(linkWithEtag))._unsafeUnwrap()

    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink(linkWithEtag),
    )
  })
})

describe('syncAllGithubLinks', () => {
  it('syncs every linked task in a single pass', async () => {
    const first = await createLinkedTask()
    const second = await createLinkedTask({ ...ref, number: 43 })

    // syncAllGithubLinks doesn't guarantee link processing order, so both
    // mocked responses use the same new title — this only asserts that
    // every link gets synced in one pass, not which one goes first.
    mockGithubIssueResponse({ title: 'Synced by trigger' })
    mockGithubIssueResponse({ title: 'Synced by trigger' })

    await syncAllGithubLinks()

    expect((await loadLink(first.link.id)).title).toBe('Synced by trigger')
    expect((await loadLink(second.link.id)).title).toBe('Synced by trigger')
  })

  it('skips syncing without error when GitHub is not connected', async () => {
    const task = await createTask('My task')
    await db.insert(taskGithubLinks).values({
      taskId: task.id,
      owner: ref.owner,
      repo: ref.repo,
      number: ref.number,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: task.title,
    })

    await syncAllGithubLinks()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask.title).toBe(task.title)
  })
})

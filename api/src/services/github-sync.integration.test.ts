import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { edits, taskGithubLinks, taskLinks, tasks } from '#db/schema'
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

async function loadEdits(taskId: string) {
  return db.select().from(edits).where(eq(edits.taskId, taskId))
}

function normalizeTask(task: typeof tasks.$inferSelect) {
  return { ...task, createdAt: 'DATE', updatedAt: 'DATE' }
}

function normalizeLink(link: typeof taskGithubLinks.$inferSelect) {
  return { ...link, lastSyncedAt: 'DATE', createdAt: 'DATE', updatedAt: 'DATE' }
}

function normalizeEdit(edit: typeof edits.$inferSelect) {
  return { ...edit, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

// A link's very first sync is seed-only (see syncLinkFromGithub's
// `isFirstSync` handling): it can't tell "GitHub changed" from "this
// snapshot was never established", so it never diffs against the task.
// Consuming that first sync here means every test below exercises a real
// second-poll diff, which is what they're actually about.
async function createSyncedLink() {
  await upsertGithubToken('valid-token')
  mockGithubIssueResponse()
  const { task, link } = (await createTaskFromGithubUrl(ref))._unsafeUnwrap()

  mockGithubIssueResponse()
  ;(await syncLinkFromGithub(link))._unsafeUnwrap()

  return { task, link: await loadLink(link.id) }
}

describe('syncLinkFromGithub', () => {
  it('updates the task title and records a system edit when the GitHub title changed', async () => {
    const { task, link } = await createSyncedLink()

    mockGithubIssueResponse({ title: 'Renamed on GitHub' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(
      normalizeTask({ ...task, title: 'Renamed on GitHub' }),
    )
    expect((await loadEdits(task.id)).map(normalizeEdit)).toEqual([
      {
        id: 'ID',
        taskId: task.id,
        pageId: null,
        commentId: null,
        action: 'update',
        field: 'title',
        authorKind: 'system',
        authorAgent: null,
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })

  it('updates the task description and records a system edit when the GitHub body changed', async () => {
    const { task, link } = await createSyncedLink()

    mockGithubIssueResponse({ body: 'Updated reproduction steps' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(
      normalizeTask({ ...task, description: 'Updated reproduction steps' }),
    )
    expect((await loadEdits(task.id)).map(normalizeEdit)).toEqual([
      {
        id: 'ID',
        taskId: task.id,
        pageId: null,
        commentId: null,
        action: 'update',
        field: 'description',
        authorKind: 'system',
        authorAgent: null,
        createdAt: 'DATE',
        updatedAt: 'DATE',
      },
    ])
  })

  it('updates the link state without touching the task status when GitHub closes the issue', async () => {
    const { task, link } = await createSyncedLink()

    mockGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({ ...link, state: 'closed' }),
    )
    expect(await loadEdits(task.id)).toEqual([])
  })

  it('leaves the task and link content untouched when nothing changed on GitHub', async () => {
    const { task, link } = await createSyncedLink()

    mockGithubIssueResponse()
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(normalizeLink(link))
    expect(await loadEdits(task.id)).toEqual([])
  })

  it('re-syncs task-link mentions when the GitHub body changed', async () => {
    const other = await createTask('Other task')
    const { task, link } = await createSyncedLink()

    mockGithubIssueResponse({ body: `See #${String(other.number)}` })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const outgoingLinks = await db
      .select({ targetTaskId: taskLinks.targetTaskId })
      .from(taskLinks)
      .where(eq(taskLinks.sourceTaskId, task.id))
    expect(outgoingLinks).toEqual([{ targetTaskId: other.id }])
  })

  it('does not overwrite a task edited in TQ when GitHub is unchanged', async () => {
    const { task, link } = await createSyncedLink()
    await db
      .update(tasks)
      .set({ description: 'Edited locally in TQ' })
      .where(eq(tasks.id, task.id))

    mockGithubIssueResponse()
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(
      normalizeTask({ ...task, description: 'Edited locally in TQ' }),
    )
  })

  it('seeds a link on its first sync without overwriting the task, even if the stored snapshot looks stale', async () => {
    // Simulates a link that predates the body/lastSyncedAt-vs-createdAt
    // tracking this relies on (e.g. one backfilled by the migration that
    // introduced this column): its stored title/body can't be trusted as a
    // real "last known GitHub value", so the first sync must seed rather
    // than diff.
    const createdTask = await createTask('My task', {
      description: 'Locally written description',
    })
    const task = await loadTask(createdTask.id)
    await upsertGithubToken('valid-token')
    const link = firstOrThrow(
      await db
        .insert(taskGithubLinks)
        .values({
          taskId: task.id,
          owner: ref.owner,
          repo: ref.repo,
          number: ref.number,
          kind: 'issue',
          url: 'https://github.com/fohte/tq/issues/42',
          state: 'open',
          title: 'Stale title from before this link had a trusted snapshot',
          body: null,
        })
        .returning(),
    )
    const editsBeforeSync = await loadEdits(task.id)

    mockGithubIssueResponse({ title: 'Actual GitHub title' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(await loadEdits(task.id)).toEqual(editsBeforeSync)

    const syncedLink = await loadLink(link.id)
    expect(syncedLink.title).toBe('Actual GitHub title')
  })

  it('checks in without diffing when GitHub reports no change via ETag', async () => {
    const { task, link } = await createSyncedLink()

    // Establish an etag baseline: the fetched content is identical to the
    // stored snapshot, so this hits the "nothing changed" path, which also
    // stores the etag for next time.
    mockGithubIssueResponse({}, { headers: { etag: '"abc123"' } })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()
    const linkWithEtag = await loadLink(link.id)
    expect(linkWithEtag.etag).toBe('"abc123"')

    mockGithubNotModifiedResponse()
    ;(await syncLinkFromGithub(linkWithEtag))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(await loadEdits(task.id)).toEqual([])
    expect((await loadLink(link.id)).etag).toBe('"abc123"')
  })
})

describe('syncAllGithubLinks', () => {
  it('syncs every linked task in a single pass', async () => {
    const first = await createSyncedLink()

    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const { task: secondTask, link: secondLink } = (
      await createTaskFromGithubUrl({ ...ref, number: 43 })
    )._unsafeUnwrap()
    mockGithubIssueResponse()
    ;(await syncLinkFromGithub(secondLink))._unsafeUnwrap()

    // syncAllGithubLinks doesn't guarantee link processing order, so both
    // mocked responses use the same new title — this only asserts that
    // every link gets synced in one pass, not which one goes first.
    mockGithubIssueResponse({ title: 'Synced by trigger' })
    mockGithubIssueResponse({ title: 'Synced by trigger' })

    await syncAllGithubLinks()

    expect((await loadTask(first.task.id)).title).toBe('Synced by trigger')
    expect((await loadTask(secondTask.id)).title).toBe('Synced by trigger')
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
      body: task.description,
    })

    await syncAllGithubLinks()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask.title).toBe(task.title)
  })
})

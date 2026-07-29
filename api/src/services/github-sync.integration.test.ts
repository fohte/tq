import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { db } from '#db/connection'
import { edits, taskGithubLinks, taskLinks, tasks } from '#db/schema'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { createTask } from '#routes/tasks/testing'
import { syncAllGithubLinks, syncLinkFromGithub } from '#services/github-sync'
import { createTaskFromGithubUrl } from '#services/task-github-links'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

const ref = { owner: 'fohte', repo: 'tq', number: 42 }

async function createLinkedTask(
  overrides: Partial<Record<string, unknown>> = {},
) {
  await upsertGithubToken('valid-token')
  mockGithubIssueResponse(overrides)
  return (await createTaskFromGithubUrl(ref))._unsafeUnwrap()
}

async function loadTask(id: string) {
  return db.query.tasks.findFirst({ where: eq(tasks.id, id) })
}

async function loadLink(id: string) {
  return db.query.taskGithubLinks.findFirst({
    where: eq(taskGithubLinks.id, id),
  })
}

async function loadEdits(taskId: string) {
  return db.select().from(edits).where(eq(edits.taskId, taskId))
}

function normalizeEdit(edit: typeof edits.$inferSelect) {
  return { ...edit, id: 'ID', createdAt: 'DATE', updatedAt: 'DATE' }
}

describe('syncLinkFromGithub', () => {
  it('updates the task title and records a system edit when the GitHub title changed', async () => {
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse({ title: 'Renamed on GitHub' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask?.title).toBe('Renamed on GitHub')

    const editRows = await loadEdits(task.id)
    expect(editRows.map(normalizeEdit)).toEqual([
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
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse({ body: 'Updated reproduction steps' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask?.description).toBe('Updated reproduction steps')

    const editRows = await loadEdits(task.id)
    expect(editRows.map(normalizeEdit)).toEqual([
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
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask?.status).toBe('todo')

    const updatedLink = await loadLink(link.id)
    expect(updatedLink?.state).toBe('closed')

    expect(await loadEdits(task.id)).toEqual([])
  })

  it('leaves the task and link untouched when nothing changed on GitHub', async () => {
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse()
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask?.title).toBe(task.title)
    expect(updatedTask?.description).toBe(task.description)

    expect(await loadEdits(task.id)).toEqual([])
  })

  it('re-syncs task-link mentions when the GitHub body changed', async () => {
    const other = await createTask('Other task')
    const { task, link } = await createLinkedTask()

    mockGithubIssueResponse({ body: `See #${String(other.number)}` })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const outgoingLinks = await db
      .select({ targetTaskId: taskLinks.targetTaskId })
      .from(taskLinks)
      .where(eq(taskLinks.sourceTaskId, task.id))
    expect(outgoingLinks).toEqual([{ targetTaskId: other.id }])
  })

  it('does not overwrite a task edited in TQ when GitHub is unchanged', async () => {
    const { task, link } = await createLinkedTask()
    await db
      .update(tasks)
      .set({ description: 'Edited locally in TQ' })
      .where(eq(tasks.id, task.id))

    mockGithubIssueResponse()
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask?.description).toBe('Edited locally in TQ')
  })
})

describe('syncAllGithubLinks', () => {
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
    expect(updatedTask?.title).toBe(task.title)
  })
})

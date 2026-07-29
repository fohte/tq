import { afterEach, describe, expect, it, vi } from 'vitest'

import { taskGithubLinks } from '#db/schema'
import {
  mockGithubIssueResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { createTask, TEST_UUID } from '#routes/tasks/testing'
import {
  createTaskFromGithubUrl,
  GithubLinkNotFoundError,
  GithubResourceAlreadyLinkedError,
  linkTaskToGithubUrl,
  resolveGithubUrl,
  TaskAlreadyLinkedError,
  TaskNotFoundError,
  unlinkTask,
} from '#services/task-github-links'
import { setupTestDb } from '#testing'

setupTestDb()

afterEach(() => {
  vi.restoreAllMocks()
})

function normalizeLink(link: typeof taskGithubLinks.$inferSelect) {
  return {
    ...link,
    id: 'ID',
    lastSyncedAt: 'DATE',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

const ref = { owner: 'fohte', repo: 'tq', number: 42 }

describe('resolveGithubUrl', () => {
  it('returns a preview when the issue is not linked to any task', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const resolved = (await resolveGithubUrl(ref))._unsafeUnwrap()

    expect(resolved).toEqual({
      preview: {
        owner: 'fohte',
        repo: 'tq',
        number: 42,
        kind: 'issue',
        url: 'https://github.com/fohte/tq/issues/42',
        title: 'Bug: something broke',
        body: 'Steps to reproduce...',
        state: 'open',
      },
    })
  })

  it('returns the existing task and link when already linked', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const created = (await createTaskFromGithubUrl(ref))._unsafeUnwrap()

    const resolved = (await resolveGithubUrl(ref))._unsafeUnwrap()

    expect(resolved).toEqual({
      existingTask: created.task,
      existingLink: created.link,
    })
  })
})

describe('createTaskFromGithubUrl', () => {
  it('creates a task from the issue title/body and links it', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const { task, link, created } = (
      await createTaskFromGithubUrl(ref)
    )._unsafeUnwrap()

    expect(created).toBe(true)
    expect(normalizeLink(link)).toEqual({
      id: 'ID',
      taskId: task.id,
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Bug: something broke',
      body: 'Steps to reproduce...',
      etag: null,
      lastSyncedAt: 'DATE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns the existing task instead of creating a duplicate', async () => {
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    const first = (await createTaskFromGithubUrl(ref))._unsafeUnwrap()

    const second = (await createTaskFromGithubUrl(ref))._unsafeUnwrap()

    expect(second).toEqual({ ...first, created: false })
  })
})

describe('linkTaskToGithubUrl', () => {
  it('links an existing task to a GitHub issue', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()

    const link = (await linkTaskToGithubUrl(task.id, ref))._unsafeUnwrap()

    expect(normalizeLink(link)).toEqual({
      id: 'ID',
      taskId: task.id,
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Bug: something broke',
      body: 'Steps to reproduce...',
      etag: null,
      lastSyncedAt: 'DATE',
      createdAt: 'DATE',
      updatedAt: 'DATE',
    })
  })

  it('returns a TaskNotFoundError for a non-existent task', async () => {
    const error = (await linkTaskToGithubUrl(TEST_UUID, ref))._unsafeUnwrapErr()

    expect(error).toEqual(new TaskNotFoundError())
  })

  it('returns a TaskAlreadyLinkedError when the task already has a link', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    ;(await linkTaskToGithubUrl(task.id, ref))._unsafeUnwrap()

    mockGithubIssueResponse({
      html_url: 'https://github.com/fohte/tq/issues/43',
    })
    const error = (
      await linkTaskToGithubUrl(task.id, { ...ref, number: 43 })
    )._unsafeUnwrapErr()

    expect(error).toEqual(new TaskAlreadyLinkedError())
  })

  it('returns a GithubResourceAlreadyLinkedError when the issue is linked to another task', async () => {
    const linkedTask = await createTask('Already linked')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    ;(await linkTaskToGithubUrl(linkedTask.id, ref))._unsafeUnwrap()

    const otherTask = await createTask('Another task')
    const error = (
      await linkTaskToGithubUrl(otherTask.id, ref)
    )._unsafeUnwrapErr()

    expect(error).toEqual(new GithubResourceAlreadyLinkedError(linkedTask.id))
  })
})

describe('unlinkTask', () => {
  it('removes the link, leaving the task intact', async () => {
    const task = await createTask('My task')
    await upsertGithubToken('valid-token')
    mockGithubIssueResponse()
    ;(await linkTaskToGithubUrl(task.id, ref))._unsafeUnwrap()

    ;(await unlinkTask(task.id))._unsafeUnwrap()

    mockGithubIssueResponse()
    const resolved = (await resolveGithubUrl(ref))._unsafeUnwrap()
    expect('preview' in resolved).toBe(true)
  })

  it('returns a GithubLinkNotFoundError when the task has no link', async () => {
    const task = await createTask('My task')

    const error = (await unlinkTask(task.id))._unsafeUnwrapErr()

    expect(error).toEqual(new GithubLinkNotFoundError())
  })
})

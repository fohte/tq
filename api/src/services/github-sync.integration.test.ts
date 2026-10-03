import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotification } from 'web-push'

import { db } from '#db/connection'
import { pushSubscriptions, taskGithubLinks, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import {
  mockGithubIssueResponse,
  mockGithubNotModifiedResponse,
  upsertGithubToken,
} from '#integrations/github/testing'
import { firstOrThrow } from '#lib/drizzle-utils'
import { createTask } from '#routes/tasks/testing'
import {
  syncAllGithubLinks,
  syncDueGithubLinks,
  syncLinkFromGithub,
} from '#services/github-sync'
import { createTaskFromGithubUrl } from '#services/task-github-links'
import { setupTestDb } from '#testing'

vi.mock('web-push', async (importOriginal) => {
  const actual = await importOriginal<typeof import('web-push')>()
  const mockedSendNotification = vi.fn()
  return {
    ...actual,
    sendNotification: mockedSendNotification,
    default: { ...actual, sendNotification: mockedSendNotification },
  }
})

setupTestDb()

beforeEach(() => {
  vi.mocked(sendNotification).mockReset().mockResolvedValue({
    statusCode: 201,
    body: '',
    headers: {},
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const ref = { owner: 'example-org', repo: 'example-repo', number: 42 }
const PERSONAL_ENDPOINT = 'https://push.example.com/personal-device'
const WORK_ENDPOINT = 'https://push.example.com/work-device'

async function loadTask(id: string) {
  return firstOrThrow(await db.select().from(tasks).where(eq(tasks.id, id)))
}

async function loadLink(id: string) {
  return firstOrThrow(
    await db.select().from(taskGithubLinks).where(eq(taskGithubLinks.id, id)),
  )
}

async function linkSyncOutcome(id: string) {
  return {
    link: normalizeLink(await loadLink(id)),
    notifications: sentNotifications(),
  }
}

async function taskSyncOutcome(id: string) {
  return {
    taskStatus: (await loadTask(id)).status,
    notifications: sentNotifications(),
  }
}

function normalizeTask(task: typeof tasks.$inferSelect) {
  return { ...task, createdAt: 'DATE', updatedAt: 'DATE' }
}

function normalizeLink(link: typeof taskGithubLinks.$inferSelect) {
  return {
    ...link,
    lastSyncedAt: 'DATE',
    createdAt: 'DATE',
    updatedAt: 'DATE',
  }
}

async function createLinkedTask(
  githubRef: typeof ref = ref,
  isPullRequest = false,
) {
  await upsertGithubToken('valid-token')
  mockGithubIssueResponse({
    html_url: `https://github.com/${githubRef.owner}/${githubRef.repo}/issues/${String(githubRef.number)}`,
    ...(isPullRequest ? { pull_request: {} } : {}),
  })
  return (await createTaskFromGithubUrl(githubRef))._unsafeUnwrap()
}

async function registerPush(context: 'work' | 'personal') {
  await db.insert(pushSubscriptions).values({
    endpoint: context === 'personal' ? PERSONAL_ENDPOINT : WORK_ENDPOINT,
    p256dh: 'test-p256dh-key',
    auth: 'test-auth-secret',
    context,
  })
}

function sentNotifications() {
  return vi
    .mocked(sendNotification)
    .mock.calls.map(([subscription, payload]) => ({
      endpoint: subscription.endpoint,
      payload: JSON.parse(String(payload)) as unknown,
    }))
}

function expectedNotification(title: string, task: typeof tasks.$inferSelect) {
  return [
    {
      endpoint: PERSONAL_ENDPOINT,
      payload: {
        title,
        body: `#${String(task.number)} ${task.title}`,
        taskId: task.id,
        url: `https://${APP_DOMAIN}/tasks/${task.id}`,
      },
    },
  ]
}

function mockGithubPullResponse(merged: boolean) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify({ merged }), { status: 200 }),
  )
}

async function createScheduledLink(
  role: 'subject' | 'blocker',
  number: number,
  lastSyncedAt: Date,
  state: 'open' | 'closed' | 'merged' = 'open',
) {
  const task = await createTask(`Watch item ${String(number)}`)
  return firstOrThrow(
    await db
      .insert(taskGithubLinks)
      .values({
        taskId: task.id,
        owner: ref.owner,
        repo: ref.repo,
        number,
        role,
        notifyEvents:
          role === 'subject'
            ? ['closed', 'reopened', 'comments', 'other']
            : ['closed'],
        kind: state === 'merged' ? 'pull_request' : 'issue',
        url: `https://github.com/${ref.owner}/${ref.repo}/issues/${String(number)}`,
        state,
        title: `Watch item ${String(number)}`,
        commentsCount: 2,
        githubUpdatedAt: new Date('2024-08-12T09:30:00Z'),
        lastSyncedAt,
      })
      .returning(),
  )
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

  it('stores the GitHub change metadata from a fresh response', async () => {
    const { link } = await createLinkedTask()

    mockGithubIssueResponse({
      state: 'closed',
      comments: 8,
      updated_at: '2024-08-16T13:40:00Z',
      state_reason: 'completed',
    })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({
        ...link,
        state: 'closed',
        commentsCount: 8,
        githubUpdatedAt: new Date('2024-08-16T13:40:00Z'),
        stateReason: 'completed',
      }),
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
    await registerPush('personal')
    const linkWithEtag = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({
          etag: '"abc123"',
          commentsCount: 7,
          githubUpdatedAt: new Date('2024-08-15T11:45:00Z'),
          stateReason: 'not_planned',
        })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    mockGithubNotModifiedResponse()
    ;(await syncLinkFromGithub(linkWithEtag))._unsafeUnwrap()

    expect(await linkSyncOutcome(link.id)).toEqual({
      link: normalizeLink(linkWithEtag),
      notifications: [],
    })
  })

  it('skips a merged link because its state is terminal', async () => {
    const { link } = await createLinkedTask(ref, true)
    const mergedLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ state: 'merged' })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockClear()

    ;(await syncLinkFromGithub(mergedLink))._unsafeUnwrap()

    expect(fetchSpy.mock.calls).toEqual([])
  })

  it('notifies once for a close even when comments and activity also changed', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')
    await registerPush('work')

    mockGithubIssueResponse({
      state: 'closed',
      comments: 3,
      updated_at: '2024-08-13T09:30:00Z',
      state_reason: 'completed',
    })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was closed`,
        task,
      ),
    )
  })

  it('uses the merged title for a newly merged pull request', async () => {
    const { task, link } = await createLinkedTask(ref, true)
    await registerPush('personal')

    mockGithubIssueResponse({ state: 'closed', pull_request: {} })
    mockGithubPullResponse(true)
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was merged`,
        task,
      ),
    )
  })

  it('uses the unmerged title when a pull request closes without merging', async () => {
    const { task, link } = await createLinkedTask(ref, true)
    await registerPush('personal')

    mockGithubIssueResponse({ state: 'closed', pull_request: {} })
    mockGithubPullResponse(false)
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was closed without merging`,
        task,
      ),
    )
  })

  it('identifies an issue closed as not planned', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    mockGithubIssueResponse({ state: 'closed', state_reason: 'not_planned' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was closed as not planned`,
        task,
      ),
    )
  })

  it('notifies when a closed issue is reopened', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')
    const closedLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ state: 'closed' })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    mockGithubIssueResponse({ state: 'open' })
    ;(await syncLinkFromGithub(closedLink))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was reopened`,
        task,
      ),
    )
  })

  it('reports only the comment count increase when comments and activity changed', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    mockGithubIssueResponse({
      comments: 4,
      updated_at: '2024-08-13T09:30:00Z',
    })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)}: 2 new comments`,
        task,
      ),
    )
  })

  it('notifies when only the GitHub updated timestamp changes', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    mockGithubIssueResponse({ updated_at: '2024-08-13T09:30:00Z' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} has new activity`,
        task,
      ),
    )
  })

  it('does not notify when the detected event is not selected', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')
    const commentsOnlyLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ notifyEvents: ['other'] })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    mockGithubIssueResponse({
      comments: 4,
      updated_at: '2024-08-13T09:30:00Z',
    })
    ;(await syncLinkFromGithub(commentsOnlyLink))._unsafeUnwrap()

    expect(await linkSyncOutcome(link.id)).toEqual({
      link: normalizeLink({
        ...commentsOnlyLink,
        commentsCount: 4,
        githubUpdatedAt: new Date('2024-08-13T09:30:00Z'),
      }),
      notifications: [],
    })
  })

  it('does not notify on the first observation of comments and updated time', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')
    const neverObservedLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ commentsCount: null, githubUpdatedAt: null })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    mockGithubIssueResponse({
      comments: 4,
      updated_at: '2024-08-13T09:30:00Z',
    })
    ;(await syncLinkFromGithub(neverObservedLink))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('does not notify when the linked task is completed', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')
    await db
      .update(tasks)
      .set({ status: 'completed' })
      .where(eq(tasks.id, task.id))

    mockGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(await taskSyncOutcome(task.id)).toEqual({
      taskStatus: 'completed',
      notifications: [],
    })
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
      role: 'subject',
      notifyEvents: ['closed', 'reopened', 'comments', 'other'],
      kind: 'issue',
      url: `https://github.com/${ref.owner}/${ref.repo}/issues/${String(ref.number)}`,
      state: 'open',
      title: task.title,
    })

    await syncAllGithubLinks()

    const updatedTask = await loadTask(task.id)
    expect(updatedTask.title).toBe(task.title)
  })
})

describe('syncDueGithubLinks', () => {
  it('syncs subjects hourly and blockers daily, leaving recent and merged links alone', async () => {
    await upsertGithubToken('valid-token')
    const now = Date.now()
    const subjectDue = await createScheduledLink(
      'subject',
      51,
      new Date(now - 2 * 60 * 60 * 1000),
    )
    const subjectRecent = await createScheduledLink(
      'subject',
      52,
      new Date(now - 30 * 60 * 1000),
    )
    const blockerDue = await createScheduledLink(
      'blocker',
      53,
      new Date(now - 25 * 60 * 60 * 1000),
    )
    const blockerRecent = await createScheduledLink(
      'blocker',
      54,
      new Date(now - 23 * 60 * 60 * 1000),
    )
    const mergedSubject = await createScheduledLink(
      'subject',
      55,
      new Date(now - 2 * 60 * 60 * 1000),
      'merged',
    )

    mockGithubIssueResponse()
    mockGithubIssueResponse()
    await syncDueGithubLinks()

    const synced = await Promise.all(
      [subjectDue, subjectRecent, blockerDue, blockerRecent, mergedSubject].map(
        async (link) =>
          (await loadLink(link.id)).lastSyncedAt > link.lastSyncedAt,
      ),
    )

    expect(synced).toEqual([true, false, true, false, false])
  })
})

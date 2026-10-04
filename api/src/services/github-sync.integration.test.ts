import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendNotification } from 'web-push'

import { db } from '#db/connection'
import { pushSubscriptions, taskGithubLinks, tasks } from '#db/schema'
import { APP_DOMAIN } from '#env'
import {
  makeGithubIssueResponse,
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
  queuedResponses.clear()
  vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    const path = url.pathname
    if (path === '/user') {
      return Promise.resolve(
        new Response(JSON.stringify({ login: AUTHENTICATED_GITHUB_LOGIN }), {
          status: 200,
        }),
      )
    }
    if (/\/issues\/\d+\/timeline$/.test(path)) {
      return Promise.resolve(
        takeGithubResponse(path) ??
          new Response(JSON.stringify(defaultTimelineEvents()), {
            status: 200,
          }),
      )
    }
    if (/\/pulls\/\d+$/.test(path)) {
      return Promise.resolve(
        takeGithubResponse('/pulls') ??
          new Response(JSON.stringify({ merged: false }), { status: 200 }),
      )
    }
    if (/\/issues\/\d+$/.test(path)) {
      return Promise.resolve(
        takeGithubResponse('/issues') ?? new Response('{}', { status: 404 }),
      )
    }
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
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
const AUTHENTICATED_GITHUB_LOGIN = 'authenticated-user'

const queuedResponses = new Map<string, Response[]>()

function queueGithubResponse(path: string, response: Response) {
  queuedResponses.set(path, [...(queuedResponses.get(path) ?? []), response])
}

function takeGithubResponse(path: string): Response | undefined {
  const [response, ...remaining] = queuedResponses.get(path) ?? []
  if (remaining.length === 0) {
    queuedResponses.delete(path)
  } else {
    queuedResponses.set(path, remaining)
  }
  return response
}

function queueGithubIssueResponse(
  overrides: Partial<Record<string, unknown>> = {},
  responseInit: ResponseInit = {},
) {
  queueGithubResponse(
    '/issues',
    makeGithubIssueResponse(
      `https://github.com/${ref.owner}/${ref.repo}/issues/${String(ref.number)}`,
      overrides,
      responseInit,
    ),
  )
}

function queueGithubNotModifiedResponse() {
  queueGithubResponse('/issues', new Response(null, { status: 304 }))
}

function queueGithubTimelineResponse(
  events: Array<Record<string, unknown>>,
  githubRef: typeof ref = ref,
  responseInit: ResponseInit = {},
) {
  queueGithubResponse(
    `/repos/${githubRef.owner}/${githubRef.repo}/issues/${String(githubRef.number)}/timeline`,
    new Response(JSON.stringify(events), { status: 200, ...responseInit }),
  )
}

function timelineEvent(
  event: string,
  login: string | null,
  timestamp = '2024-08-13T09:30:00Z',
) {
  return {
    event,
    ...(login === null ? {} : { actor: { login } }),
    created_at: timestamp,
  }
}

function defaultTimelineEvents() {
  return [
    timelineEvent('closed', 'another-user'),
    timelineEvent('merged', 'another-user'),
    timelineEvent('reopened', 'another-user'),
    {
      ...timelineEvent('commented', 'another-user'),
      user: { login: 'another-user' },
    },
    {
      ...timelineEvent('commented', 'another-user'),
      id: 2,
      user: { login: 'another-user' },
    },
    timelineEvent('labeled', 'another-user'),
  ]
}

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

function githubTimelineSyncOutcome() {
  const timelinePages = vi
    .mocked(globalThis.fetch)
    .mock.calls.flatMap(([input]) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      return url.pathname.endsWith('/timeline')
        ? [url.searchParams.get('page')]
        : []
    })
  return { timelinePages, notifications: sentNotifications() }
}

async function completedTaskSyncOutcome(id: string) {
  const activityRequests = vi
    .mocked(globalThis.fetch)
    .mock.calls.flatMap(([input]) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      return url.pathname === '/user' || url.pathname.endsWith('/timeline')
        ? [url.pathname]
        : []
    })
  return { task: await taskSyncOutcome(id), activityRequests }
}

function overlappingSyncOutcome(results: Array<{ isOk: () => boolean }>) {
  return {
    successfulSyncs: results.map((result) => result.isOk()),
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
  queueGithubIssueResponse({
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

function expectedNotification(
  title: string,
  task: typeof tasks.$inferSelect,
  endpoint = PERSONAL_ENDPOINT,
) {
  return [
    {
      endpoint,
      payload: {
        title,
        body: `#${String(task.number)} ${task.title}`,
        taskId: task.id,
        url: `https://${APP_DOMAIN}/tasks/${task.id}`,
      },
    },
  ]
}

function queueGithubPullResponse(merged: boolean) {
  queueGithubResponse(
    '/pulls',
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

    queueGithubIssueResponse({ title: 'Renamed on GitHub' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({ ...link, title: 'Renamed on GitHub' }),
    )
  })

  it('updates the link state when GitHub closes the issue, without touching the task status', async () => {
    const { task, link } = await createLinkedTask()

    queueGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(
      normalizeLink({ ...link, state: 'closed' }),
    )
  })

  it('stores the GitHub change metadata from a fresh response', async () => {
    const { link } = await createLinkedTask()

    queueGithubIssueResponse({
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

    queueGithubIssueResponse({ body: 'Updated reproduction steps on GitHub' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect((await loadTask(task.id)).description).toBe('Edited locally in TQ')
  })

  it('leaves the task and link content untouched when nothing changed on GitHub', async () => {
    const { task, link } = await createLinkedTask()

    queueGithubIssueResponse()
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(normalizeTask(await loadTask(task.id))).toEqual(normalizeTask(task))
    expect(normalizeLink(await loadLink(link.id))).toEqual(normalizeLink(link))
  })

  it('stores the returned etag when GitHub responds with a fresh 200', async () => {
    const { link } = await createLinkedTask()

    queueGithubIssueResponse({}, { headers: { etag: '"abc123"' } })
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

    queueGithubNotModifiedResponse()
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

    queueGithubIssueResponse({
      state: 'closed',
      comments: 3,
      updated_at: '2024-08-13T09:30:00Z',
      state_reason: 'completed',
    })
    queueGithubTimelineResponse([
      timelineEvent('closed', 'another-user'),
      {
        ...timelineEvent('commented', 'another-user'),
        user: { login: 'another-user' },
      },
      {
        ...timelineEvent('commented', 'another-user'),
        user: { login: 'another-user' },
      },
      timelineEvent('labeled', 'another-user'),
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was closed`,
        task,
      ),
    )
  })

  it('does not notify when the authenticated user closes an issue', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({ state: 'closed' })
    queueGithubTimelineResponse([
      timelineEvent('closed', AUTHENTICATED_GITHUB_LOGIN),
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('does not notify for a close event older than the stored GitHub timestamp', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')
    const previouslySyncedLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ githubUpdatedAt: new Date('2024-08-13T10:00:00Z') })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    queueGithubIssueResponse({
      state: 'closed',
      updated_at: '2024-08-14T09:30:00Z',
    })
    queueGithubTimelineResponse([
      timelineEvent('closed', 'another-user', '2024-08-13T09:30:00Z'),
    ])
    ;(await syncLinkFromGithub(previouslySyncedLink))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('suppresses self actions for blocker links as well as subject links', async () => {
    await upsertGithubToken('valid-token')
    const link = await createScheduledLink(
      'blocker',
      56,
      new Date(Date.now() - 2 * 60 * 60 * 1000),
    )
    await registerPush('personal')

    queueGithubIssueResponse({ state: 'closed' })
    queueGithubTimelineResponse(
      [timelineEvent('closed', AUTHENTICATED_GITHUB_LOGIN)],
      { ...ref, number: 56 },
    )
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('sends a change notification only once when syncs overlap', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    let resolveBothRequests: () => void = () => undefined
    let releaseRequests: () => void = () => undefined
    const bothRequestsStarted = new Promise<void>((resolve) => {
      resolveBothRequests = resolve
    })
    const requestsMayResolve = new Promise<void>((resolve) => {
      releaseRequests = resolve
    })
    let requestCount = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(input instanceof Request ? input.url : String(input))
      if (url.pathname === '/user') {
        return new Response(
          JSON.stringify({ login: AUTHENTICATED_GITHUB_LOGIN }),
          { status: 200 },
        )
      }
      if (/\/issues\/\d+\/timeline$/.test(url.pathname)) {
        return new Response(
          JSON.stringify([timelineEvent('closed', 'another-user')]),
          { status: 200 },
        )
      }

      requestCount += 1
      if (requestCount === 2) {
        resolveBothRequests()
      }
      await requestsMayResolve
      return new Response(
        JSON.stringify({
          title: 'Bug: something broke',
          body: 'Steps to reproduce...',
          state: 'closed',
          comments: 2,
          updated_at: '2024-08-13T09:30:00Z',
          state_reason: 'completed',
          html_url: `https://github.com/${ref.owner}/${ref.repo}/issues/${String(ref.number)}`,
        }),
        { status: 200 },
      )
    })

    const firstSync = syncLinkFromGithub(link)
    const secondSync = syncLinkFromGithub(link)
    await bothRequestsStarted
    releaseRequests()
    const results = await Promise.all([firstSync, secondSync])

    expect(overlappingSyncOutcome(results)).toEqual({
      successfulSyncs: [true, true],
      notifications: expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was closed`,
        task,
      ),
    })
  })

  it('sends a change notification to the linked task context', async () => {
    const { task, link } = await createLinkedTask()
    await db.update(tasks).set({ context: 'work' }).where(eq(tasks.id, task.id))
    await registerPush('personal')
    await registerPush('work')

    queueGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was closed`,
        task,
        WORK_ENDPOINT,
      ),
    )
  })

  it('uses the merged title for a newly merged pull request', async () => {
    const { task, link } = await createLinkedTask(ref, true)
    await registerPush('personal')

    queueGithubIssueResponse({ state: 'closed', pull_request: {} })
    queueGithubPullResponse(true)
    queueGithubTimelineResponse([timelineEvent('merged', 'another-user')])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was merged`,
        task,
      ),
    )
  })

  it('does not notify when the authenticated user merges a pull request', async () => {
    const { link } = await createLinkedTask(ref, true)
    await registerPush('personal')

    queueGithubIssueResponse({ state: 'closed', pull_request: {} })
    queueGithubPullResponse(true)
    queueGithubTimelineResponse([
      timelineEvent('merged', AUTHENTICATED_GITHUB_LOGIN),
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('uses the unmerged title when a pull request closes without merging', async () => {
    const { task, link } = await createLinkedTask(ref, true)
    await registerPush('personal')

    queueGithubIssueResponse({ state: 'closed', pull_request: {} })
    queueGithubPullResponse(false)
    queueGithubTimelineResponse([timelineEvent('closed', 'another-user')])
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

    queueGithubIssueResponse({ state: 'closed', state_reason: 'not_planned' })
    queueGithubTimelineResponse([timelineEvent('closed', 'another-user')])
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

    queueGithubIssueResponse({ state: 'open' })
    queueGithubTimelineResponse([timelineEvent('reopened', 'another-user')])
    ;(await syncLinkFromGithub(closedLink))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} was reopened`,
        task,
      ),
    )
  })

  it('does not notify when the authenticated user reopens an issue', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')
    const closedLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ state: 'closed' })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    queueGithubIssueResponse({ state: 'open' })
    queueGithubTimelineResponse([
      timelineEvent('reopened', AUTHENTICATED_GITHUB_LOGIN),
    ])
    ;(await syncLinkFromGithub(closedLink))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('reports only the comment count increase when comments and activity changed', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({
      comments: 4,
      updated_at: '2024-08-13T09:30:00Z',
    })
    queueGithubTimelineResponse([
      {
        ...timelineEvent('commented', 'another-user'),
        user: { login: 'another-user' },
      },
      {
        ...timelineEvent('commented', 'another-user'),
        id: 2,
        user: { login: 'another-user' },
      },
      timelineEvent('labeled', 'another-user'),
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)}: 2 new comments`,
        task,
      ),
    )
  })

  it('counts only comments written by other users', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({
      comments: 4,
      updated_at: '2024-08-13T09:30:00Z',
    })
    queueGithubTimelineResponse([
      {
        event: 'commented',
        user: { login: AUTHENTICATED_GITHUB_LOGIN },
        created_at: '2024-08-13T09:30:00Z',
      },
      {
        event: 'commented',
        actor: { login: 'another-user' },
        user: { login: 'another-user' },
        created_at: '2024-08-13T09:31:00Z',
      },
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)}: 1 new comment`,
        task,
      ),
    )
  })

  it('does not notify when the authenticated user is the only commenter', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({
      comments: 3,
      updated_at: '2024-08-13T09:30:00Z',
    })
    queueGithubTimelineResponse([
      {
        event: 'commented',
        user: { login: AUTHENTICATED_GITHUB_LOGIN },
        created_at: '2024-08-13T09:30:00Z',
      },
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('notifies when only the GitHub updated timestamp changes', async () => {
    const { task, link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({ updated_at: '2024-08-13T09:30:00Z' })
    queueGithubTimelineResponse([
      {
        event: 'reviewed',
        user: { login: 'another-user' },
        submitted_at: '2024-08-13T09:30:00Z',
      },
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual(
      expectedNotification(
        `${ref.owner}/${ref.repo}#${String(ref.number)} has new activity`,
        task,
      ),
    )
  })

  it('does not notify about other activity performed by the authenticated user', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({ updated_at: '2024-08-13T09:30:00Z' })
    queueGithubTimelineResponse([
      {
        event: 'reviewed',
        user: { login: AUTHENTICATED_GITHUB_LOGIN },
        submitted_at: '2024-08-13T09:30:00Z',
      },
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('does not notify for a commit event without a GitHub login', async () => {
    const { link } = await createLinkedTask(ref, true)
    await registerPush('personal')

    queueGithubIssueResponse({ updated_at: '2024-08-13T09:30:00Z' })
    queueGithubTimelineResponse([timelineEvent('committed', null)])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(sentNotifications()).toEqual([])
  })

  it('follows timeline pages before classifying an activity', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')

    queueGithubIssueResponse({ updated_at: '2024-08-13T09:30:00Z' })
    queueGithubTimelineResponse(
      [timelineEvent('labeled', 'another-user', '2024-08-12T09:00:00Z')],
      ref,
      {
        headers: {
          link: `<https://api.github.com/repos/${ref.owner}/${ref.repo}/issues/${String(ref.number)}/timeline?page=2>; rel="next"`,
        },
      },
    )
    queueGithubTimelineResponse([
      timelineEvent('reviewed', AUTHENTICATED_GITHUB_LOGIN),
    ])
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(githubTimelineSyncOutcome()).toEqual({
      timelinePages: [null, '2'],
      notifications: [],
    })
  })

  it('does not notify when the detected event is not selected', async () => {
    const { link } = await createLinkedTask()
    await registerPush('personal')
    const otherOnlyLink = firstOrThrow(
      await db
        .update(taskGithubLinks)
        .set({ notifyEvents: ['other'] })
        .where(eq(taskGithubLinks.id, link.id))
        .returning(),
    )

    queueGithubIssueResponse({
      comments: 4,
      updated_at: '2024-08-13T09:30:00Z',
    })
    queueGithubTimelineResponse([
      {
        ...timelineEvent('commented', 'another-user'),
        user: { login: 'another-user' },
      },
    ])
    ;(await syncLinkFromGithub(otherOnlyLink))._unsafeUnwrap()

    expect(await linkSyncOutcome(link.id)).toEqual({
      link: normalizeLink({
        ...otherOnlyLink,
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

    queueGithubIssueResponse({
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

    queueGithubIssueResponse({ state: 'closed' })
    ;(await syncLinkFromGithub(link))._unsafeUnwrap()

    expect(await completedTaskSyncOutcome(task.id)).toEqual({
      task: { taskStatus: 'completed', notifications: [] },
      activityRequests: [],
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
    queueGithubIssueResponse({ title: 'Synced by trigger' })
    queueGithubIssueResponse({ title: 'Synced by trigger' })

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
      new Date(now - 59 * 60 * 1000),
    )
    const blockerDue = await createScheduledLink(
      'blocker',
      53,
      new Date(now - 25 * 60 * 60 * 1000),
    )
    const blockerRecent = await createScheduledLink(
      'blocker',
      54,
      new Date(now - 23 * 60 * 60 * 1000 - 59 * 60 * 1000),
    )
    const mergedSubject = await createScheduledLink(
      'subject',
      55,
      new Date(now - 2 * 60 * 60 * 1000),
      'merged',
    )

    queueGithubIssueResponse()
    queueGithubIssueResponse()
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

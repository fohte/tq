import { eq } from 'drizzle-orm'
import { afterEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { db } from '#db/connection'
import { taskGithubLinks, taskWaits } from '#db/schema'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
import { firstOrThrow } from '#lib/drizzle-utils'
import {
  createTask,
  type TaskListItemResponse,
  type TaskResponse,
  type TaskWaitResponse,
  type TaskWaitSummaryResponse,
} from '#routes/tasks/testing'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

let stopWatchingChanges: (() => void) | undefined

afterEach(() => {
  stopWatchingChanges?.()
  stopWatchingChanges = undefined
})

function dateAtOffset(date: Date, tzOffset: number): string {
  const result = new Date(date.getTime() - tzOffset * 60_000)
  return `${String(result.getUTCFullYear())}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`
}

function addDaysAtOffset(date: Date, tzOffset: number, days: number): string {
  const result = new Date(`${dateAtOffset(date, tzOffset)}T00:00:00.000Z`)
  result.setUTCDate(result.getUTCDate() + days)
  return result.toISOString().slice(0, 10)
}

function offsetWithDifferentUtcDate(date: Date): number {
  return date.getUTCHours() < 12 ? 720 : -720
}

function addWait(
  taskId: string | number,
  body: string,
  followUpDate?: string,
  tzOffset?: number,
) {
  return app.request(`/api/tasks/${String(taskId)}/waits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, followUpDate, tzOffset }),
  })
}

function addGithubWait(
  taskId: string,
  githubUrl: string,
  followUpDate: string,
) {
  return app.request(`/api/tasks/${taskId}/waits`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ githubUrl, followUpDate }),
  })
}

async function createGithubBlocker(
  taskId: string,
  role: 'subject' | 'blocker' = 'blocker',
  state: 'open' | 'closed' = 'open',
  number = 42,
) {
  return firstOrThrow(
    await db
      .insert(taskGithubLinks)
      .values({
        taskId,
        owner: 'example-org',
        repo: 'example-repo',
        number,
        role,
        notifyEvents:
          role === 'subject'
            ? ['closed', 'reopened', 'comments', 'other']
            : ['closed'],
        kind: 'pull_request',
        url: `https://github.com/example-org/example-repo/pull/${String(number)}`,
        state,
        title: 'Example pull request',
      })
      .returning(),
  )
}

function normalizeWait(wait: TaskWaitResponse) {
  const resolvedTogether =
    wait.resolvedAt != null && wait.resolvedAt === wait.acknowledgedAt
  return {
    ...wait,
    id: 'WAIT_ID',
    resolvedAt: resolvedTogether
      ? 'RESOLVED_AT'
      : wait.resolvedAt == null
        ? null
        : 'RESOLVED_AT',
    acknowledgedAt: resolvedTogether
      ? 'RESOLVED_AT'
      : wait.acknowledgedAt == null
        ? null
        : 'ACKNOWLEDGED_AT',
    createdAt: 'CREATED_AT',
  }
}

function normalizeSummary(wait: TaskWaitSummaryResponse) {
  const resolvedTogether =
    wait.resolvedAt != null && wait.resolvedAt === wait.acknowledgedAt
  return {
    ...wait,
    id: 'WAIT_ID',
    resolvedAt: wait.resolvedAt == null ? null : 'RESOLVED_AT',
    acknowledgedAt: resolvedTogether
      ? 'RESOLVED_AT'
      : wait.acknowledgedAt == null
        ? null
        : 'ACKNOWLEDGED_AT',
  }
}

function waitStateSnapshot(wait: typeof taskWaits.$inferSelect) {
  return {
    resolvedAt: wait.resolvedAt?.toISOString() ?? null,
    acknowledgedAt: wait.acknowledgedAt?.toISOString() ?? null,
  }
}

function waitResponseSnapshot<T>(status: number, wait: T) {
  return { status, wait }
}

function bodyResponseSnapshot<T>(status: number, body: T) {
  return { status, body }
}

function waitCollectionsSnapshot<TResolved, TDetail, TSummary>(
  resolved: TResolved,
  detail: TDetail,
  list: TSummary,
) {
  return { resolved, detail, list }
}

function waitUpdatesSnapshot<T>(
  bodyStatus: number,
  bodyUpdate: T,
  dateStatus: number,
  dateUpdate: T,
) {
  return [
    waitResponseSnapshot(bodyStatus, bodyUpdate),
    waitResponseSnapshot(dateStatus, dateUpdate),
  ]
}

function waitFilterSnapshot<T>(
  blockers: T,
  noBlockers: T,
  followUpDue: T,
  resolvedWait: T,
) {
  return { blockers, noBlockers, followUpDue, resolvedWait }
}

function waitRemovalSnapshot<T>(
  wrongOwnerStatus: number,
  removeStatus: number,
  repeatedStatus: number,
  waits: T,
) {
  return { wrongOwnerStatus, removeStatus, repeatedStatus, waits }
}

describe('task waits API', () => {
  it('creates a wait using a task number and defaults the follow-up date to three days later', async () => {
    const task = await createTask('Waiting task')
    const tzOffset = offsetWithDifferentUtcDate(new Date())
    const res = await addWait(
      task.number,
      '### Waiting for a reply\nMore detail',
      undefined,
      tzOffset,
    )

    const wait = await jsonBody<TaskWaitResponse>(res)
    expect(waitResponseSnapshot(res.status, normalizeWait(wait))).toEqual({
      status: 201,
      wait: {
        id: 'WAIT_ID',
        taskId: task.id,
        body: '### Waiting for a reply\nMore detail',
        label: '### Waiting for a reply',
        followUpDate: addDaysAtOffset(new Date(wait.createdAt), tzOffset, 3),
        githubLinkId: null,
        resolvedAt: null,
        acknowledgedAt: null,
        createdAt: 'CREATED_AT',
      },
    })
  })

  it('attaches a bodyless wait to an open GitHub blocker', async () => {
    const task = await createTask('Waiting for a pull request')
    const link = await createGithubBlocker(task.id)
    const created = await addGithubWait(task.id, link.url, '2036-04-05')
    const wait = await jsonBody<TaskWaitResponse>(created)

    const actual = waitResponseSnapshot(created.status, normalizeWait(wait))
    expect(actual).toEqual({
      status: 201,
      wait: {
        id: 'WAIT_ID',
        taskId: task.id,
        body: null,
        label: 'Waiting for GitHub activity',
        followUpDate: '2036-04-05',
        githubLinkId: link.id,
        resolvedAt: null,
        acknowledgedAt: null,
        createdAt: 'CREATED_AT',
      },
    })
  })

  it('rejects a second unresolved wait for the same GitHub blocker', async () => {
    const task = await createTask('Waiting for a pull request')
    const link = await createGithubBlocker(task.id)
    await addGithubWait(task.id, link.url, '2036-04-05')

    const duplicate = await addGithubWait(task.id, link.url, '2036-04-05')
    const actual = bodyResponseSnapshot(
      duplicate.status,
      await jsonBody<{ error: string }>(duplicate),
    )

    expect(actual).toEqual({
      status: 409,
      body: { error: 'Wait already exists for this GitHub blocker' },
    })
  })

  it('removes a GitHub wait without removing its blocker', async () => {
    const task = await createTask('Waiting for a pull request')
    const link = await createGithubBlocker(task.id)
    const wait = await jsonBody<TaskWaitResponse>(
      await addGithubWait(task.id, link.url, '2036-04-05'),
    )

    const removed = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}`,
      { method: 'DELETE' },
    )
    const [remainingWaits, remainingLinks] = await Promise.all([
      db.select().from(taskWaits),
      db.select().from(taskGithubLinks),
    ])
    expect(
      waitResponseSnapshot(removed.status, {
        waits: remainingWaits,
        githubLinkIds: remainingLinks.map((row) => row.id),
      }),
    ).toEqual({
      status: 204,
      wait: {
        waits: [],
        githubLinkIds: [link.id],
      },
    })
  })

  it('allows a new wait after the previous GitHub wait is resolved', async () => {
    const task = await createTask('Waiting for a pull request')
    const link = await createGithubBlocker(task.id)
    const previousWait = await jsonBody<TaskWaitResponse>(
      await addGithubWait(task.id, link.url, '2036-04-05'),
    )
    await db
      .update(taskWaits)
      .set({ createdAt: new Date('2020-01-01T00:00:00.000Z') })
      .where(eq(taskWaits.id, previousWait.id))
    const resolved = await app.request(
      `/api/tasks/${task.id}/waits/${previousWait.id}/resolve`,
      { method: 'POST' },
    )

    const created = await addGithubWait(task.id, link.url, '2036-04-06')
    const detail = await app.request(`/api/tasks/${task.id}`)
    const detailBody = await jsonBody<TaskResponse>(detail)
    expect(
      waitResponseSnapshot(resolved.status, {
        createdStatus: created.status,
        waits: detailBody.waits?.map((wait) => ({
          ...normalizeWait(wait),
          id:
            wait.id === previousWait.id
              ? 'PREVIOUS_WAIT_ID'
              : 'CURRENT_WAIT_ID',
        })),
      }),
    ).toEqual({
      status: 200,
      wait: {
        createdStatus: 201,
        waits: [
          {
            id: 'PREVIOUS_WAIT_ID',
            taskId: task.id,
            body: null,
            label: 'Waiting for GitHub activity',
            followUpDate: '2036-04-05',
            githubLinkId: link.id,
            resolvedAt: 'RESOLVED_AT',
            acknowledgedAt: 'RESOLVED_AT',
            createdAt: 'CREATED_AT',
          },
          {
            id: 'CURRENT_WAIT_ID',
            taskId: task.id,
            body: null,
            label: 'Waiting for GitHub activity',
            followUpDate: '2036-04-06',
            githubLinkId: link.id,
            resolvedAt: null,
            acknowledgedAt: null,
            createdAt: 'CREATED_AT',
          },
        ],
      },
    })
  })

  it('only attaches waits to an open GitHub blocker on the same task', async () => {
    const task = await createTask('Task with no matching blocker')
    const otherTask = await createTask('Another task')
    const otherLink = await createGithubBlocker(
      otherTask.id,
      'blocker',
      'open',
      43,
    )
    const closedLink = await createGithubBlocker(task.id, 'blocker', 'closed')
    const subjectTask = await createTask('Task with a GitHub subject')
    const subjectLink = await createGithubBlocker(subjectTask.id, 'subject')
    const statuses = await Promise.all([
      (async () =>
        (await addGithubWait(task.id, otherLink.url, '2036-04-05')).status)(),
      (async () =>
        (await addGithubWait(task.id, closedLink.url, '2036-04-05')).status)(),
      (async () =>
        (await addGithubWait(subjectTask.id, subjectLink.url, '2036-04-05'))
          .status)(),
    ])

    expect(statuses).toEqual([404, 409, 404])
  })

  it('deletes a linked wait when its GitHub blocker is deleted', async () => {
    const task = await createTask('Delete a linked blocker')
    const link = await createGithubBlocker(task.id)
    await addGithubWait(task.id, link.url, '2036-04-05')
    await db.delete(taskGithubLinks).where(eq(taskGithubLinks.id, link.id))

    expect(await db.select().from(taskWaits)).toEqual([])
  })

  it('requires a body for a wait that is not attached to GitHub', async () => {
    const task = await createTask('Wait without a description')
    const response = await app.request(`/api/tasks/${task.id}/waits`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ followUpDate: '2036-04-05' }),
    })

    expect(response.status).toBe(400)
  })

  it('preserves omitted fields when updating the body and follow-up date', async () => {
    const task = await createTask('Waiting task')
    const created = await addWait(task.id, 'Original request', '2036-04-05')
    const wait = await jsonBody<TaskWaitResponse>(created)
    const bodyUpdate = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Updated request' }),
      },
    )
    const afterBodyUpdate = await jsonBody<TaskWaitResponse>(bodyUpdate)
    const dateUpdate = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followUpDate: '2036-04-12' }),
      },
    )
    const afterDateUpdate = await jsonBody<TaskWaitResponse>(dateUpdate)

    expect(
      waitUpdatesSnapshot(
        bodyUpdate.status,
        normalizeWait(afterBodyUpdate),
        dateUpdate.status,
        normalizeWait(afterDateUpdate),
      ),
    ).toEqual([
      {
        status: 200,
        wait: {
          id: 'WAIT_ID',
          taskId: task.id,
          body: 'Updated request',
          label: 'Updated request',
          followUpDate: '2036-04-05',
          githubLinkId: null,
          resolvedAt: null,
          acknowledgedAt: null,
          createdAt: 'CREATED_AT',
        },
      },
      {
        status: 200,
        wait: {
          id: 'WAIT_ID',
          taskId: task.id,
          body: 'Updated request',
          label: 'Updated request',
          followUpDate: '2036-04-12',
          githubLinkId: null,
          resolvedAt: null,
          acknowledgedAt: null,
          createdAt: 'CREATED_AT',
        },
      },
    ])
  })

  it('returns every wait in detail and a compact summary in the task list after resolution', async () => {
    const task = await createTask('Waiting task')
    const created = await addWait(
      task.id,
      'A response was received',
      '2036-04-05',
    )
    const wait = await jsonBody<TaskWaitResponse>(created)
    await addWait(task.id, 'B response is pending', '2036-04-06')
    const resolved = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/resolve`,
      { method: 'POST' },
    )
    const resolvedWait = await jsonBody<TaskWaitResponse>(resolved)
    const [detailRes, listRes] = await Promise.all([
      app.request(`/api/tasks/${task.id}`),
      app.request(
        `/api/tasks?view=full&context=all&status=all&limit=unlimited&ids=${task.id}`,
      ),
    ])
    const detail = await jsonBody<TaskResponse>(detailRes)
    const [listItem] = await jsonBody<TaskListItemResponse[]>(listRes)

    expect(
      waitCollectionsSnapshot(
        normalizeWait(resolvedWait),
        detail.waits
          ?.map(normalizeWait)
          .sort((left, right) => left.label.localeCompare(right.label)),
        listItem?.waits
          ?.map(normalizeSummary)
          .sort((left, right) => left.label.localeCompare(right.label)),
      ),
    ).toEqual({
      resolved: {
        id: 'WAIT_ID',
        taskId: task.id,
        body: 'A response was received',
        label: 'A response was received',
        followUpDate: '2036-04-05',
        githubLinkId: null,
        resolvedAt: 'RESOLVED_AT',
        acknowledgedAt: 'RESOLVED_AT',
        createdAt: 'CREATED_AT',
      },
      detail: [
        {
          id: 'WAIT_ID',
          taskId: task.id,
          body: 'A response was received',
          label: 'A response was received',
          followUpDate: '2036-04-05',
          githubLinkId: null,
          resolvedAt: 'RESOLVED_AT',
          acknowledgedAt: 'RESOLVED_AT',
          createdAt: 'CREATED_AT',
        },
        {
          id: 'WAIT_ID',
          taskId: task.id,
          body: 'B response is pending',
          label: 'B response is pending',
          followUpDate: '2036-04-06',
          githubLinkId: null,
          resolvedAt: null,
          acknowledgedAt: null,
          createdAt: 'CREATED_AT',
        },
      ],
      list: [
        {
          id: 'WAIT_ID',
          label: 'A response was received',
          followUpDate: '2036-04-05',
          githubLinkId: null,
          resolvedAt: 'RESOLVED_AT',
          acknowledgedAt: 'RESOLVED_AT',
        },
        {
          id: 'WAIT_ID',
          label: 'B response is pending',
          followUpDate: '2036-04-06',
          githubLinkId: null,
          resolvedAt: null,
          acknowledgedAt: null,
        },
      ],
    })
  })

  it('rejects acknowledging an unresolved wait', async () => {
    const task = await createTask('Acknowledge a reply')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(task.id, 'Waiting for a reply', '2036-04-05'),
    )
    const response = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )

    expect(response.status).toEqual(409)
  })

  it('acknowledges an automatically resolved wait', async () => {
    const task = await createTask('Acknowledge a reply')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(task.id, 'Waiting for a reply', '2036-04-05'),
    )
    await db
      .update(taskWaits)
      .set({ resolvedAt: new Date('2036-04-04T12:00:00.000Z') })
      .where(eq(taskWaits.id, wait.id))
    const response = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )

    const responseWait = await jsonBody<TaskWaitResponse>(response)
    const actual = waitResponseSnapshot(
      response.status,
      normalizeWait(responseWait),
    )
    expect(actual).toEqual({
      status: 200,
      wait: {
        id: 'WAIT_ID',
        taskId: task.id,
        body: 'Waiting for a reply',
        label: 'Waiting for a reply',
        followUpDate: '2036-04-05',
        githubLinkId: null,
        resolvedAt: 'RESOLVED_AT',
        acknowledgedAt: 'ACKNOWLEDGED_AT',
        createdAt: 'CREATED_AT',
      },
    })
  })

  it('keeps the original acknowledgement timestamp when acknowledge is repeated', async () => {
    const task = await createTask('Acknowledge a reply')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(task.id, 'Waiting for a reply', '2036-04-05'),
    )
    await db
      .update(taskWaits)
      .set({ resolvedAt: new Date('2036-04-04T12:00:00.000Z') })
      .where(eq(taskWaits.id, wait.id))
    await app.request(`/api/tasks/${task.id}/waits/${wait.id}/acknowledge`, {
      method: 'POST',
    })
    const fixedAcknowledgedAt = new Date('2020-02-03T04:05:06.000Z')
    await db
      .update(taskWaits)
      .set({ acknowledgedAt: fixedAcknowledgedAt })
      .where(eq(taskWaits.id, wait.id))

    const response = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )
    const responseWait = await jsonBody<TaskWaitResponse>(response)
    const actual = waitResponseSnapshot(response.status, {
      ...normalizeWait(responseWait),
      resolvedAt: responseWait.resolvedAt,
      acknowledgedAt: responseWait.acknowledgedAt,
    })

    expect(actual).toEqual({
      status: 200,
      wait: {
        id: 'WAIT_ID',
        taskId: task.id,
        body: 'Waiting for a reply',
        label: 'Waiting for a reply',
        followUpDate: '2036-04-05',
        githubLinkId: null,
        resolvedAt: '2036-04-04T12:00:00.000Z',
        acknowledgedAt: fixedAcknowledgedAt.toISOString(),
        createdAt: 'CREATED_AT',
      },
    })
  })

  it('does not acknowledge a wait through another task', async () => {
    const owner = await createTask('Wait owner')
    const other = await createTask('Other task')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(owner.id, 'Waiting for a reply', '2036-04-05'),
    )
    const resolvedAt = new Date('2036-04-04T12:00:00.000Z')
    await db
      .update(taskWaits)
      .set({ resolvedAt })
      .where(eq(taskWaits.id, wait.id))
    const [before] = await db
      .select()
      .from(taskWaits)
      .where(eq(taskWaits.id, wait.id))
    const response = await app.request(
      `/api/tasks/${other.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )
    const [after] = await db
      .select()
      .from(taskWaits)
      .where(eq(taskWaits.id, wait.id))
    expect(
      waitResponseSnapshot(response.status, {
        before: before == null ? null : waitStateSnapshot(before),
        after: after == null ? null : waitStateSnapshot(after),
      }),
    ).toEqual({
      status: 404,
      wait: {
        before: {
          resolvedAt: resolvedAt.toISOString(),
          acknowledgedAt: null,
        },
        after: {
          resolvedAt: resolvedAt.toISOString(),
          acknowledgedAt: null,
        },
      },
    })
  })

  it('treats only unresolved waits as blockers and finds follow-ups due today', async () => {
    const dueTask = await createTask('Due wait')
    const futureTask = await createTask('Future wait')
    const resolvedTask = await createTask('Resolved wait')
    const unacknowledgedTask = await createTask('Unacknowledged resolved wait')
    const clearTask = await createTask('No wait')
    const now = new Date()
    const tzOffset = offsetWithDifferentUtcDate(now)
    await addWait(dueTask.id, 'Due today', addDaysAtOffset(now, tzOffset, 0))
    await addWait(futureTask.id, 'Due later', addDaysAtOffset(now, tzOffset, 1))
    const resolved = await jsonBody<TaskWaitResponse>(
      await addWait(
        resolvedTask.id,
        'Already answered',
        addDaysAtOffset(now, tzOffset, -1),
      ),
    )
    await app.request(
      `/api/tasks/${resolvedTask.id}/waits/${resolved.id}/resolve`,
      { method: 'POST' },
    )
    const unacknowledged = await jsonBody<TaskWaitResponse>(
      await addWait(
        unacknowledgedTask.id,
        'New reply',
        addDaysAtOffset(now, tzOffset, -1),
      ),
    )
    await db
      .update(taskWaits)
      .set({ resolvedAt: new Date() })
      .where(eq(taskWaits.id, unacknowledged.id))

    const taskIds = async (query: string) => {
      const response = await app.request(
        `/api/tasks?view=full&${new URLSearchParams({
          context: 'all',
          status: 'all',
          limit: 'unlimited',
          q: query,
          tzOffset: String(tzOffset),
        }).toString()}`,
      )
      const body: unknown = await response.json()
      const ids = Array.isArray(body)
        ? body.flatMap((item: unknown) =>
            typeof item === 'object' &&
            item !== null &&
            'id' in item &&
            typeof item.id === 'string'
              ? [item.id]
              : [],
          )
        : []
      return { status: response.status, taskIds: ids.sort() }
    }

    expect(
      waitFilterSnapshot(
        await taskIds('has:blockers'),
        await taskIds('has:no-blockers'),
        await taskIds('has:follow-up-due'),
        await taskIds('has:resolved-wait'),
      ),
    ).toEqual({
      blockers: { status: 200, taskIds: [dueTask.id, futureTask.id].sort() },
      noBlockers: {
        status: 200,
        taskIds: [resolvedTask.id, unacknowledgedTask.id, clearTask.id].sort(),
      },
      followUpDue: { status: 200, taskIds: [dueTask.id] },
      resolvedWait: { status: 200, taskIds: [unacknowledgedTask.id] },
    })
  })

  it('includes only due follow-ups among blocked tasks in queue candidates', async () => {
    const now = new Date()
    const tzOffset = offsetWithDifferentUtcDate(now)
    const today = dateAtOffset(now, tzOffset)
    const regularCandidate = await createTask('Regular candidate', {
      dueDate: today,
    })
    const blocker = await createTask('Incomplete blocker')
    const blockedCandidate = await createTask('Blocked candidate', {
      dueDate: today,
    })
    await app.request(`/api/tasks/${blockedCandidate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedBy: [blocker.id] }),
    })
    const dueFollowUp = await createTask('Due follow-up candidate')
    const overdueFollowUp = await createTask('Overdue follow-up candidate')
    const futureFollowUp = await createTask('Future follow-up')
    const resolvedFollowUp = await createTask('Resolved follow-up')
    await addWait(dueFollowUp.id, 'Check in', today)
    await addWait(
      overdueFollowUp.id,
      'Check in again',
      addDaysAtOffset(now, tzOffset, -1),
    )
    await addWait(
      futureFollowUp.id,
      'Check in later',
      addDaysAtOffset(now, tzOffset, 1),
    )
    const resolvedWait = await jsonBody<TaskWaitResponse>(
      await addWait(
        resolvedFollowUp.id,
        'Already answered',
        addDaysAtOffset(now, tzOffset, -1),
      ),
    )
    await app.request(
      `/api/tasks/${resolvedFollowUp.id}/waits/${resolvedWait.id}/resolve`,
      { method: 'POST' },
    )

    const response = await app.request(
      `/api/tasks?view=full&context=all&status=todo&limit=unlimited&candidatesOn=${today}`,
    )
    const body = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      bodyResponseSnapshot(
        response.status,
        body.map((task) => task.id),
      ),
    ).toEqual({
      status: 200,
      body: [overdueFollowUp.id, dueFollowUp.id, regularCandidate.id],
    })
  })

  it('returns candidate reasons and reason priority from the API', async () => {
    const now = new Date()
    const tzOffset = offsetWithDifferentUtcDate(now)
    const today = dateAtOffset(now, tzOffset)
    await createTask('Overdue task', {
      dueDate: addDaysAtOffset(now, tzOffset, -2),
      commitment: 'inbox',
    })
    const followUp = await createTask('Follow-up task', {
      commitment: 'inbox',
    })
    await createTask('Due today task', {
      dueDate: today,
      commitment: 'inbox',
    })
    await createTask('Due later task', {
      dueDate: addDaysAtOffset(now, tzOffset, 2),
      commitment: 'active',
    })
    await createTask('Starting task', {
      startDate: today,
      commitment: 'inbox',
    })
    await createTask('Active task', {
      commitment: 'active',
    })
    await addWait(followUp.id, 'Check in', today)

    const response = await app.request(
      `/api/tasks?view=full&context=all&status=todo&limit=unlimited&candidatesOn=${today}`,
    )
    const body = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      bodyResponseSnapshot(
        response.status,
        body.map((task) => ({
          title: task.title,
          reason: task.candidateReason,
        })),
      ),
    ).toEqual({
      status: 200,
      body: [
        { title: 'Overdue task', reason: { kind: 'overdue', days: 2 } },
        { title: 'Follow-up task', reason: { kind: 'follow-up', days: 0 } },
        { title: 'Due today task', reason: { kind: 'due-today' } },
        { title: 'Due later task', reason: { kind: 'due-later', days: 2 } },
        { title: 'Starting task', reason: { kind: 'starts', days: 0 } },
        { title: 'Active task', reason: { kind: 'active' } },
      ],
    })
  })

  it('returns no candidate reason for completed tasks', async () => {
    const task = await createTask('Completed candidate', {
      dueDate: '2036-04-09',
    })
    await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })

    const response = await app.request(
      '/api/tasks?view=full&context=all&status=all&limit=unlimited&candidatesOn=2036-04-10',
    )
    const body = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      bodyResponseSnapshot(
        response.status,
        body.map(({ id, candidateReason }) => ({ id, candidateReason })),
      ),
    ).toEqual({
      status: 200,
      body: [{ id: task.id, candidateReason: null }],
    })
  })

  it('classifies the earliest unresolved follow-up against the requested candidate date', async () => {
    const task = await createTask('Multiple follow-ups')
    const resolvedWait = await jsonBody<TaskWaitResponse>(
      await addWait(task.id, 'Resolved older follow-up', '2036-04-01'),
    )
    await app.request(
      `/api/tasks/${task.id}/waits/${resolvedWait.id}/resolve`,
      { method: 'POST' },
    )
    await addWait(task.id, 'Earlier unresolved follow-up', '2036-04-07')
    await addWait(task.id, 'Later unresolved follow-up', '2036-04-09')
    await addWait(task.id, 'Future follow-up', '2036-04-11')

    const response = await app.request(
      '/api/tasks?view=full&context=all&status=todo&limit=unlimited&candidatesOn=2036-04-10',
    )
    const body = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      bodyResponseSnapshot(
        response.status,
        body.map(({ id, candidateReason }) => ({ id, candidateReason })),
      ),
    ).toEqual({
      status: 200,
      body: [{ id: task.id, candidateReason: { kind: 'follow-up', days: 3 } }],
    })
  })

  it('prefers a follow-up reason when the task also has an overdue due date', async () => {
    const now = new Date()
    const tzOffset = offsetWithDifferentUtcDate(now)
    const today = dateAtOffset(now, tzOffset)
    const task = await createTask('Overdue task with follow-up', {
      dueDate: addDaysAtOffset(now, tzOffset, -2),
      commitment: 'inbox',
    })
    await addWait(task.id, 'Check in', addDaysAtOffset(now, tzOffset, -1))

    const response = await app.request(
      `/api/tasks?view=full&context=all&status=todo&limit=unlimited&candidatesOn=${today}`,
    )
    const body = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      bodyResponseSnapshot(response.status, body[0]?.candidateReason ?? null),
    ).toEqual({
      status: 200,
      body: { kind: 'follow-up', days: 1 },
    })
  })

  it('sorts blockers by their earliest unresolved follow-up before undated blockers', async () => {
    const now = new Date()
    const tzOffset = offsetWithDifferentUtcDate(now)
    const earlier = await createTask('Earlier follow-up')
    const multiple = await createTask('Multiple follow-ups')
    const later = await createTask('Later follow-up')
    const resolvedOld = await createTask('Resolved old follow-up')
    const blocker = await createTask('Task blocker')
    const blockedTask = await createTask('Blocked by task')
    await app.request(`/api/tasks/${blockedTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedBy: [blocker.id] }),
    })
    const resolved = await createTask('Resolved wait')
    await addWait(
      earlier.id,
      'Earlier reminder',
      addDaysAtOffset(now, tzOffset, -2),
    )
    await addWait(
      multiple.id,
      'Later reminder',
      addDaysAtOffset(now, tzOffset, 4),
    )
    await addWait(
      multiple.id,
      'Earlier reminder',
      addDaysAtOffset(now, tzOffset, 1),
    )
    await addWait(later.id, 'Later reminder', addDaysAtOffset(now, tzOffset, 2))
    const resolvedOldWait = await jsonBody<TaskWaitResponse>(
      await addWait(
        resolvedOld.id,
        'Resolved early reminder',
        addDaysAtOffset(now, tzOffset, -5),
      ),
    )
    await app.request(
      `/api/tasks/${resolvedOld.id}/waits/${resolvedOldWait.id}/resolve`,
      { method: 'POST' },
    )
    await addWait(
      resolvedOld.id,
      'Unresolved reminder',
      addDaysAtOffset(now, tzOffset, 3),
    )
    const resolvedWait = await jsonBody<TaskWaitResponse>(
      await addWait(
        resolved.id,
        'Resolved reminder',
        addDaysAtOffset(now, tzOffset, -5),
      ),
    )
    await app.request(
      `/api/tasks/${resolved.id}/waits/${resolvedWait.id}/resolve`,
      {
        method: 'POST',
      },
    )

    const response = await app.request(
      '/api/tasks?view=full&context=all&status=todo&limit=unlimited' +
        '&q=has%3Ablockers&sortBy=follow-up',
    )
    const body = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      bodyResponseSnapshot(
        response.status,
        body.map((task) => task.title),
      ),
    ).toEqual({
      status: 200,
      body: [
        'Earlier follow-up',
        'Multiple follow-ups',
        'Later follow-up',
        'Resolved old follow-up',
        'Blocked by task',
      ],
    })
  })

  it('counts inbox tasks without unresolved blockers', async () => {
    await createTask('Clear inbox task', {
      commitment: 'inbox',
    })
    const blockedTask = await createTask('Waiting inbox task', {
      commitment: 'inbox',
    })
    await addWait(
      blockedTask.id,
      'Awaiting response',
      dateAtOffset(new Date(), 0),
    )

    const response = await app.request(
      '/api/tasks/count?context=all&status=todo&commitment=inbox&q=has%3Ano-blockers',
    )
    const body = await jsonBody<{ count: number }>(response)

    expect(bodyResponseSnapshot(response.status, body.count)).toEqual({
      status: 200,
      body: 1,
    })
  })

  it('rejects completion while an unresolved wait remains', async () => {
    const task = await createTask('Waiting task')
    await addWait(task.id, 'Waiting for a reply', '2036-04-05')
    const res = await app.request(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    const body = await jsonBody<{
      error: string
      blockedByNumbers: number[]
      blockedByGithubRefs: unknown[]
      blockedByWaits: TaskWaitSummaryResponse[]
    }>(res)

    expect(
      bodyResponseSnapshot(res.status, {
        ...body,
        blockedByWaits: body.blockedByWaits.map(normalizeSummary),
      }),
    ).toEqual({
      status: 409,
      body: {
        error:
          'Task is blocked by unresolved blockers: wait Waiting for a reply',
        blockedByNumbers: [],
        blockedByGithubRefs: [],
        blockedByWaits: [
          {
            id: 'WAIT_ID',
            label: 'Waiting for a reply',
            followUpDate: '2036-04-05',
            githubLinkId: null,
            resolvedAt: null,
            acknowledgedAt: null,
          },
        ],
      },
    })
  })

  it('emits task change events for add, update, resolve, and remove writes', async () => {
    const task = await createTask('Waiting task')
    const events: ChangeEvent[] = []
    stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))

    const created = await addWait(task.id, 'Original request', '2036-04-05')
    const wait = await jsonBody<TaskWaitResponse>(created)
    await app.request(`/api/tasks/${task.id}/waits/${wait.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: 'Updated request' }),
    })
    await app.request(`/api/tasks/${task.id}/waits/${wait.id}/resolve`, {
      method: 'POST',
    })
    await app.request(`/api/tasks/${task.id}/waits/${wait.id}`, {
      method: 'DELETE',
    })

    expect(events).toEqual(
      Array.from({ length: 4 }, () => ({
        resource: 'task',
        id: task.id,
        origin: null,
        taskIds: [task.id],
      })),
    )
  })

  it('emits a task change event when acknowledging an automatic resolution', async () => {
    const task = await createTask('Acknowledge a resolved wait')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(task.id, 'Waiting for a reply', '2036-04-05'),
    )
    await db
      .update(taskWaits)
      .set({ resolvedAt: new Date() })
      .where(eq(taskWaits.id, wait.id))
    const events: ChangeEvent[] = []
    stopWatchingChanges = subscribeToChangeEvents((event) => events.push(event))

    const response = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )

    expect(response.status).toEqual(200)
    expect(events).toEqual([
      {
        resource: 'task',
        id: task.id,
        origin: null,
        taskIds: [task.id],
      },
    ])
  })

  it('removes waits only from their owning task and returns 404 after deletion', async () => {
    const owner = await createTask('Owner task')
    const other = await createTask('Other task')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(owner.id, 'Remove this wait', '2036-04-05'),
    )
    const wrongOwner = await app.request(
      `/api/tasks/${other.id}/waits/${wait.id}`,
      { method: 'DELETE' },
    )
    const removed = await app.request(
      `/api/tasks/${owner.id}/waits/${wait.id}`,
      { method: 'DELETE' },
    )
    const repeated = await app.request(
      `/api/tasks/${owner.id}/waits/${wait.id}`,
      { method: 'DELETE' },
    )
    const detail = await app.request(`/api/tasks/${owner.id}`)
    const detailBody = await jsonBody<TaskResponse>(detail)

    const actual = waitRemovalSnapshot(
      wrongOwner.status,
      removed.status,
      repeated.status,
      detailBody.waits ?? [],
    )
    expect(actual).toEqual({
      wrongOwnerStatus: 404,
      removeStatus: 204,
      repeatedStatus: 404,
      waits: [],
    })
  })
})

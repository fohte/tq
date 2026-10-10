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

  it('attaches a bodyless wait to an open GitHub blocker and removes the wait independently', async () => {
    const task = await createTask('Waiting for a pull request')
    const link = await createGithubBlocker(task.id)
    const created = await addGithubWait(task.id, link.url, '2036-04-05')
    const wait = await jsonBody<TaskWaitResponse>(created)
    const duplicate = await addGithubWait(task.id, link.url, '2036-04-05')
    const removed = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}`,
      { method: 'DELETE' },
    )
    const [remainingWaits, remainingLinks] = await Promise.all([
      db.select().from(taskWaits),
      db.select().from(taskGithubLinks),
    ])

    expect(waitResponseSnapshot(created.status, normalizeWait(wait))).toEqual({
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
    expect(duplicate.status).toEqual(409)
    expect(removed.status).toEqual(204)
    expect(remainingWaits).toEqual([])
    expect(remainingLinks.map((row) => row.id)).toEqual([link.id])
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

  it('acknowledges an automatically resolved wait and keeps the action idempotent', async () => {
    const task = await createTask('Acknowledge a reply')
    const wait = await jsonBody<TaskWaitResponse>(
      await addWait(task.id, 'Waiting for a reply', '2036-04-05'),
    )
    const unresolvedAcknowledge = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )
    await db
      .update(taskWaits)
      .set({ resolvedAt: new Date('2036-04-04T12:00:00.000Z') })
      .where(eq(taskWaits.id, wait.id))
    const acknowledged = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )
    const repeated = await app.request(
      `/api/tasks/${task.id}/waits/${wait.id}/acknowledge`,
      { method: 'POST' },
    )

    expect(unresolvedAcknowledge.status).toEqual(409)
    expect(
      waitResponseSnapshot(
        acknowledged.status,
        normalizeWait(await jsonBody<TaskWaitResponse>(acknowledged)),
      ),
    ).toEqual({
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
    expect(
      waitResponseSnapshot(
        repeated.status,
        normalizeWait(await jsonBody<TaskWaitResponse>(repeated)),
      ),
    ).toEqual({
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

    expect(
      waitRemovalSnapshot(
        wrongOwner.status,
        removed.status,
        repeated.status,
        detailBody.waits ?? [],
      ),
    ).toEqual({
      wrongOwnerStatus: 404,
      removeStatus: 204,
      repeatedStatus: 404,
      waits: [],
    })
  })
})

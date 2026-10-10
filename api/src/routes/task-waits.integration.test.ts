import { afterEach, describe, expect, it } from 'vitest'

import { app } from '#app'
import { type ChangeEvent, subscribeToChangeEvents } from '#lib/change-events'
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
  return {
    ...wait,
    id: 'WAIT_ID',
    resolvedAt: wait.resolvedAt == null ? null : 'RESOLVED_AT',
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

function waitFilterSnapshot<T>(blockers: T, noBlockers: T, followUpDue: T) {
  return { blockers, noBlockers, followUpDue }
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
        resolvedAt: null,
        acknowledgedAt: null,
        createdAt: 'CREATED_AT',
      },
    })
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
          resolvedAt: 'RESOLVED_AT',
        },
        {
          id: 'WAIT_ID',
          label: 'B response is pending',
          followUpDate: '2036-04-06',
          resolvedAt: null,
        },
      ],
    })
  })

  it('treats only unresolved waits as blockers and finds follow-ups due today', async () => {
    const dueTask = await createTask('Due wait')
    const futureTask = await createTask('Future wait')
    const resolvedTask = await createTask('Resolved wait')
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
      ),
    ).toEqual({
      blockers: { status: 200, taskIds: [dueTask.id, futureTask.id].sort() },
      noBlockers: {
        status: 200,
        taskIds: [resolvedTask.id, clearTask.id].sort(),
      },
      followUpDue: { status: 200, taskIds: [dueTask.id] },
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
    const futureFollowUp = await createTask('Future follow-up')
    const resolvedFollowUp = await createTask('Resolved follow-up')
    await addWait(dueFollowUp.id, 'Check in', today)
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
      body: [regularCandidate.id, dueFollowUp.id],
    })
  })

  it('sorts blockers by their earliest unresolved follow-up before undated blockers', async () => {
    const now = new Date()
    const tzOffset = offsetWithDifferentUtcDate(now)
    const earlier = await createTask('Earlier follow-up')
    const later = await createTask('Later follow-up')
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
    await addWait(later.id, 'Later reminder', addDaysAtOffset(now, tzOffset, 2))
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
      body: ['Earlier follow-up', 'Later follow-up', 'Blocked by task'],
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
            resolvedAt: null,
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

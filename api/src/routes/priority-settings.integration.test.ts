import { describe, expect, it } from 'vitest'

import { app } from '#app'
import { createTask, type TaskListItemResponse } from '#routes/tasks/testing'
import type { PrioritySetting } from '#schemas/priority-settings'
import { jsonBody, setupTestDb } from '#testing'

setupTestDb()

const headers = { 'Content-Type': 'application/json' }
const defaultPrioritySettings: PrioritySetting[] = [
  { priority: 2, name: '最優先', description: '', sortOrder: 0 },
  { priority: 1, name: '早めにやる', description: '', sortOrder: 1 },
  { priority: 0, name: 'やりたい', description: '', sortOrder: 2 },
  { priority: null, name: 'Inbox', description: '', sortOrder: 3 },
  { priority: -1, name: '後回し', description: '', sortOrder: 4 },
]

async function updateSettings(settings: unknown) {
  return app.request('/api/priority-settings', {
    method: 'PUT',
    headers,
    body: JSON.stringify(settings),
  })
}

async function getSettings() {
  const response = await app.request('/api/priority-settings')
  return jsonBody<PrioritySetting[]>(response)
}

async function settingsResponseSnapshot(response: Response) {
  return {
    status: response.status,
    body: await jsonBody<PrioritySetting[]>(response),
  }
}

function settingsStateSnapshot(status: number, settings: PrioritySetting[]) {
  return { status, settings }
}

function priorityOrderSnapshot(ascending: string[], descending: string[]) {
  return { ascending, descending }
}

describe('priority settings API', () => {
  it('returns fixed seeded priorities in their initial order', async () => {
    expect(await getSettings()).toEqual(defaultPrioritySettings)
  })

  it('replaces all fixed priority labels, descriptions, and order', async () => {
    const settings = [
      { priority: -1, name: 'Defer', description: 'Later', sortOrder: 0 },
      { priority: null, name: 'Inbox', description: 'Unsorted', sortOrder: 1 },
      {
        priority: 0,
        name: 'Routine',
        description: 'When possible',
        sortOrder: 2,
      },
      {
        priority: 1,
        name: 'Soon',
        description: 'In the near term',
        sortOrder: 3,
      },
      {
        priority: 2,
        name: 'First',
        description: 'Do this first',
        sortOrder: 4,
      },
    ]

    const response = await updateSettings(settings)

    expect(await settingsResponseSnapshot(response)).toEqual({
      status: 200,
      body: settings,
    })
  })

  it('rejects invalid replacement lists without changing the saved settings', async () => {
    const invalidSettings = defaultPrioritySettings.map((setting, index) =>
      index === 4 ? { ...setting, priority: 2 } : setting,
    )

    const response = await updateSettings(invalidSettings)
    expect(settingsStateSnapshot(response.status, await getSettings())).toEqual(
      {
        status: 400,
        settings: defaultPrioritySettings,
      },
    )
  })

  it('sorts by configured order, direction, and due date within a priority', async () => {
    await updateSettings([
      { priority: null, name: 'Inbox', description: '', sortOrder: 0 },
      { priority: -1, name: 'Later', description: '', sortOrder: 1 },
      { priority: 0, name: 'Routine', description: '', sortOrder: 2 },
      { priority: 2, name: 'First', description: '', sortOrder: 3 },
      { priority: 1, name: 'Soon', description: '', sortOrder: 4 },
    ])
    await createTask('Priority two task', { priority: 2 })
    await createTask('Deferred task', { priority: -1 })
    await createTask('Inbox task', { priority: null })
    await createTask('Later due task', {
      priority: 0,
      dueDate: '2036-05-12',
    })
    await createTask('Earlier due task', {
      priority: 0,
      dueDate: '2036-05-11',
    })

    const response = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&sortBy=priority',
    )
    const tasks = await jsonBody<TaskListItemResponse[]>(response)
    const descendingResponse = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&sortBy=priority&order=desc',
    )
    const descendingTasks =
      await jsonBody<TaskListItemResponse[]>(descendingResponse)

    expect(
      priorityOrderSnapshot(
        tasks.map(({ title }) => title),
        descendingTasks.map(({ title }) => title),
      ),
    ).toEqual({
      ascending: [
        'Inbox task',
        'Deferred task',
        'Earlier due task',
        'Later due task',
        'Priority two task',
      ],
      descending: [
        'Priority two task',
        'Earlier due task',
        'Later due task',
        'Deferred task',
        'Inbox task',
      ],
    })
  })

  it('sorts search results with the sort:priority token', async () => {
    await createTask('Inbox task', { priority: null })
    await createTask('Priority zero task', { priority: 0 })

    const response = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&q=sort%3Apriority',
    )
    const tasks = await jsonBody<TaskListItemResponse[]>(response)

    expect(tasks.map(({ title }) => title)).toEqual([
      'Priority zero task',
      'Inbox task',
    ])
  })

  it('keeps a priority zero task with a future start date as a default candidate', async () => {
    await createTask('Deferred without dates', { priority: -1 })
    await createTask('Inbox without dates', { priority: null })
    await createTask('Routine with a future start', {
      priority: 0,
      startDate: '2036-05-12',
    })
    await createTask('Deferred due today', {
      priority: -1,
      dueDate: '2036-05-10',
    })
    await createTask('Routine due today', {
      priority: 0,
      dueDate: '2036-05-10',
    })

    const response = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&candidatesOn=2036-05-10',
    )
    const candidates = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      candidates.map(({ title, candidateReason }) => ({
        title,
        candidateReason,
      })),
    ).toEqual([
      { title: 'Routine due today', candidateReason: { kind: 'due-today' } },
      {
        title: 'Deferred due today',
        candidateReason: { kind: 'due-today' },
      },
      {
        title: 'Routine with a future start',
        candidateReason: { kind: 'priority', label: 'やりたい' },
      },
    ])
  })

  it('reorders candidate inclusion and labels when the Inbox position changes', async () => {
    await updateSettings([
      { priority: -1, name: 'Defer', description: '', sortOrder: 0 },
      { priority: 2, name: 'First', description: '', sortOrder: 1 },
      { priority: null, name: 'Inbox', description: '', sortOrder: 2 },
      { priority: 0, name: 'Routine', description: '', sortOrder: 3 },
      { priority: 1, name: 'Soon', description: '', sortOrder: 4 },
    ])
    await createTask('Deferred without dates', { priority: -1 })
    await createTask('Inbox without dates', { priority: null })
    await createTask('Highest without dates', { priority: 2 })
    await createTask('Routine with a future start', {
      priority: 0,
      startDate: '2036-05-12',
    })
    await createTask('Deferred due today', {
      priority: -1,
      dueDate: '2036-05-10',
    })
    await createTask('Routine due today', {
      priority: 0,
      dueDate: '2036-05-10',
    })
    await createTask('Deferred due later', {
      priority: -1,
      dueDate: '2036-05-12',
    })

    const response = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&candidatesOn=2036-05-10',
    )
    const candidates = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      candidates.map(({ title, candidateReason }) => ({
        title,
        candidateReason,
      })),
    ).toEqual([
      { title: 'Deferred due today', candidateReason: { kind: 'due-today' } },
      { title: 'Routine due today', candidateReason: { kind: 'due-today' } },
      {
        title: 'Deferred due later',
        candidateReason: { kind: 'due-later', days: 2 },
      },
      {
        title: 'Deferred without dates',
        candidateReason: { kind: 'priority', label: 'Defer' },
      },
      {
        title: 'Highest without dates',
        candidateReason: { kind: 'priority', label: 'First' },
      },
    ])
  })

  it('orders overdue candidates by configured priority before their due dates', async () => {
    await updateSettings([
      { priority: 1, name: 'Soon', description: '', sortOrder: 0 },
      { priority: 0, name: 'Routine', description: '', sortOrder: 1 },
      { priority: null, name: 'Inbox', description: '', sortOrder: 2 },
      { priority: 2, name: 'First', description: '', sortOrder: 3 },
      { priority: -1, name: 'Later', description: '', sortOrder: 4 },
    ])
    await createTask('Routine with an earlier due date', {
      priority: 0,
      dueDate: '2036-05-08',
    })
    await createTask('Soon with a later due date', {
      priority: 1,
      dueDate: '2036-05-09',
    })

    const response = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&candidatesOn=2036-05-10',
    )
    const candidates = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      candidates.map(({ title, candidateReason }) => ({
        title,
        candidateReason,
      })),
    ).toEqual([
      {
        title: 'Soon with a later due date',
        candidateReason: { kind: 'overdue', days: 1 },
      },
      {
        title: 'Routine with an earlier due date',
        candidateReason: { kind: 'overdue', days: 2 },
      },
    ])
  })

  it('orders deferred overdue candidates after higher priorities despite older due dates', async () => {
    await createTask('Deferred with an earlier due date', {
      priority: -1,
      dueDate: '2036-05-08',
    })
    await createTask('Routine with a later due date', {
      priority: 0,
      dueDate: '2036-05-09',
    })

    const response = await app.request(
      '/api/tasks?view=row&context=all&status=todo&limit=unlimited&candidatesOn=2036-05-10',
    )
    const candidates = await jsonBody<TaskListItemResponse[]>(response)

    expect(
      candidates.map(({ title, candidateReason }) => ({
        title,
        candidateReason,
      })),
    ).toEqual([
      {
        title: 'Routine with a later due date',
        candidateReason: { kind: 'overdue', days: 1 },
      },
      {
        title: 'Deferred with an earlier due date',
        candidateReason: { kind: 'overdue', days: 2 },
      },
    ])
  })
})

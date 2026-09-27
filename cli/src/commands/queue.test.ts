import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStderr,
  spyStdout,
} from '#commands/test-support'

async function runQueueCli(args: string[], response: Response) {
  const { fetchStub, calls } = captureFetch(() => response)
  const stderr = spyStderr()
  const stdout = spyStdout()
  const exitCode = await runCli(
    ['--api-url', apiUrl, ...args],
    fetchStub,
    fakeStdin(true),
  )

  return {
    exitCode,
    requests: calls.map(request),
    stderr: stderr.mock.calls,
    stdout: stdout.mock.calls,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('queue list', () => {
  it('requests the queue list and prints the response array', async () => {
    const queues = [
      { key: 'day', name: 'today', periodUnit: 'day', position: 0 },
    ]

    expect(
      await runQueueCli(
        ['queue', 'list'],
        new Response(JSON.stringify(queues), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        { method: 'GET', pathname: '/api/queues', query: {}, body: undefined },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(queues, null, 2)}\n`]],
    })
  })
})

describe('queue get', () => {
  it('requests the given queue key and date and prints the response array', async () => {
    const rows = [
      {
        id: 'tt1',
        taskId: 'task1',
        periodStart: '2026-08-06',
        sortOrder: 0,
        createdAt: '2026-08-06T00:00:00.000Z',
        updatedAt: '2026-08-06T00:00:00.000Z',
      },
    ]

    expect(
      await runQueueCli(
        ['queue', 'get', 'day', '2026-08-06'],
        new Response(JSON.stringify(rows), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/queues/day/items',
          query: { date: '2026-08-06' },
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(rows, null, 2)}\n`]],
    })
  })

  it('uses the current UTC date when the date is omitted', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))

    expect(
      await runQueueCli(
        ['queue', 'get', 'day'],
        new Response(JSON.stringify([]), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/queues/day/items',
          query: { date: '2026-08-06' },
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [['[]\n']],
    })
  })
})

describe('queue set', () => {
  it('sends the date and given task ids as the request body', async () => {
    const updated = [
      { id: 'tt1', taskId: 'task1', periodStart: '2026-08-06', sortOrder: 0 },
      { id: 'tt2', taskId: 'task2', periodStart: '2026-08-06', sortOrder: 1 },
    ]
    const taskIds = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]

    expect(
      await runQueueCli(
        ['queue', 'set', 'week', '2026-08-06', ...taskIds],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PUT',
          pathname: '/api/queues/week/items',
          query: {},
          body: { date: '2026-08-06', taskIds },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })

  it('sends an empty taskIds array when task ids are omitted', async () => {
    expect(
      await runQueueCli(
        ['queue', 'set', 'day', '2026-08-06'],
        new Response(JSON.stringify([]), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PUT',
          pathname: '/api/queues/day/items',
          query: {},
          body: { date: '2026-08-06', taskIds: [] },
        },
      ],
      stderr: [],
      stdout: [['[]\n']],
    })
  })

  it('rejects invalid task UUIDs before sending a request', async () => {
    expect(
      await runQueueCli(
        ['queue', 'set', 'day', '2026-08-06', 'not-a-uuid'],
        new Response(JSON.stringify([]), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [['Error: taskIds.0: Invalid UUID\n']],
      stdout: [],
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  spyStdout,
} from '#commands/test-support'

function summarizeQueueRun(exitCode: number, calls: unknown, stdout?: unknown) {
  return stdout === undefined
    ? { exitCode, calls }
    : { exitCode, calls, stdout }
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
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(queues), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'queue', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeQueueRun(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'GET',
          url: `${apiUrl}/api/queues`,
          headers: {},
          body: undefined,
        },
      ],
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
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(rows), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'queue', 'get', 'day', '2026-08-06'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeQueueRun(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'GET',
          url: `${apiUrl}/api/queues/day/items?date=2026-08-06`,
          headers: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(rows, null, 2)}\n`]],
    })
  })

  it('uses the current UTC date when the date is omitted', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-06T12:00:00.000Z'))
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'queue', 'get', 'day'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeQueueRun(exitCode, calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'GET',
          url: `${apiUrl}/api/queues/day/items?date=2026-08-06`,
          headers: {},
          body: undefined,
        },
      ],
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
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'queue', 'set', 'week', '2026-08-06', ...taskIds],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeQueueRun(exitCode, calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'PUT',
          url: `${apiUrl}/api/queues/week/items`,
          headers: { 'content-type': 'application/json' },
          body: { date: '2026-08-06', taskIds },
        },
      ],
    })
  })

  it('sends an empty taskIds array when task ids are omitted', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'queue', 'set', 'day', '2026-08-06'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeQueueRun(exitCode, calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'PUT',
          url: `${apiUrl}/api/queues/day/items`,
          headers: { 'content-type': 'application/json' },
          body: { date: '2026-08-06', taskIds: [] },
        },
      ],
    })
  })
})

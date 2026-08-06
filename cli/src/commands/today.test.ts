import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { captureFetch, fakeStdin, spyStdout } from '#test-utils'

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('today get', () => {
  it('requests the given date and prints the response array', async () => {
    const rows = [
      {
        id: 'tt1',
        taskId: 'task1',
        date: '2026-08-06',
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
      ['--api-url', apiUrl, 'today', 'get', '2026-08-06'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.url).toBe(
      `${apiUrl}/api/schedule/today-tasks?date=2026-08-06`,
    )
    expect(write.mock.calls).toEqual([[`${JSON.stringify(rows, null, 2)}\n`]])
  })
})

describe('today set', () => {
  it('sends the date and given task ids as the request body', async () => {
    const updated = [
      { id: 'tt1', taskId: 'task1', date: '2026-08-06', sortOrder: 0 },
      { id: 'tt2', taskId: 'task2', date: '2026-08-06', sortOrder: 1 },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'today', 'set', '2026-08-06', 'task1', 'task2'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      date: '2026-08-06',
      taskIds: ['task1', 'task2'],
    })
  })

  it('sends an empty taskIds array when task ids are omitted', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'today', 'set', '2026-08-06'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ date: '2026-08-06', taskIds: [] })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { captureFetch, fakeStdin, spyStdout } from '#test-utils'

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('calendar events', () => {
  it('requests events between timeMin and timeMax and prints the response array', async () => {
    const events = [{ id: 'ev1', summary: 'Standup' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(events), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'calendar',
        'events',
        '2026-08-06T00:00:00.000Z',
        '2026-08-07T00:00:00.000Z',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'GET',
        url: `${apiUrl}/api/calendar/events?timeMin=2026-08-06T00%3A00%3A00.000Z&timeMax=2026-08-07T00%3A00%3A00.000Z`,
        headers: {},
        body: undefined,
      },
    ])
    expect(write.mock.calls).toEqual([[`${JSON.stringify(events, null, 2)}\n`]])
  })
})

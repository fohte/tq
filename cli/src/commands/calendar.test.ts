import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

async function runCalendarCli(args: string[], response: Response) {
  const { fetchStub, calls } = captureFetch(() => response)
  const write = spyStdout()
  const exitCode = await runCli(
    ['--api-url', apiUrl, ...args],
    fetchStub,
    fakeStdin(true),
  )

  return {
    exitCode,
    requests: calls.map(request),
    stdout: write.mock.calls,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('calendar events', () => {
  it('requests events between timeMin and timeMax and prints the response array', async () => {
    const events = [{ id: 'ev1', summary: 'Standup' }]
    const timeMin = '2026-08-06T00:00:00.000Z'
    const timeMax = '2026-08-07T00:00:00.000Z'

    expect(
      await runCalendarCli(
        ['calendar', 'events', timeMin, timeMax],
        new Response(JSON.stringify(events), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/calendar/events',
          query: { timeMin, timeMax },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(events, null, 2)}\n`]],
    })
  })
})

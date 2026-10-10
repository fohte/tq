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

const SCHEDULE_ID = '11111111-1111-4111-8111-111111111111'

async function runScheduleOverrideCli(args: string[], response: Response) {
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
})

describe('schedule override set', () => {
  it('sends the replacement time for one occurrence', async () => {
    const override = {
      scheduleId: SCHEDULE_ID,
      occurrenceDate: '2026-03-22',
      startTime: '08:30',
      endTime: '09:45',
      skipped: false,
    }

    expect(
      await runScheduleOverrideCli(
        [
          'schedule',
          'override',
          'set',
          SCHEDULE_ID,
          '2026-03-22',
          '--start-time',
          '08:30',
          '--end-time',
          '09:45',
        ],
        new Response(JSON.stringify(override), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PUT',
          pathname: `/api/schedule/events/${SCHEDULE_ID}/overrides/2026-03-22`,
          query: {},
          body: { startTime: '08:30', endTime: '09:45' },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(override, null, 2)}\n`]],
    })
  })

  it('sends a skip mode without time values', async () => {
    const override = {
      scheduleId: SCHEDULE_ID,
      occurrenceDate: '2026-03-22',
      startTime: null,
      endTime: null,
      skipped: true,
    }

    expect(
      await runScheduleOverrideCli(
        [
          'schedule',
          'override',
          'set',
          SCHEDULE_ID,
          '2026-03-22',
          '--mode',
          'skip',
        ],
        new Response(JSON.stringify(override), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PUT',
          pathname: `/api/schedule/events/${SCHEDULE_ID}/overrides/2026-03-22`,
          query: {},
          body: { skipped: true },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(override, null, 2)}\n`]],
    })
  })
})

describe('schedule override clear', () => {
  it('clears the override for one occurrence', async () => {
    expect(
      await runScheduleOverrideCli(
        ['schedule', 'override', 'clear', SCHEDULE_ID, '2026-03-22'],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'DELETE',
          pathname: `/api/schedule/events/${SCHEDULE_ID}/overrides/2026-03-22`,
          query: {},
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [
        [
          `${JSON.stringify(
            {
              cleared: true,
              scheduleId: SCHEDULE_ID,
              occurrenceDate: '2026-03-22',
            },
            null,
            2,
          )}\n`,
        ],
      ],
    })
  })
})

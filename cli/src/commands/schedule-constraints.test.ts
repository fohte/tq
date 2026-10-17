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
const CONSTRAINTS = {
  weeklyMin: 3,
  weeklyMax: 4,
  weeklyTarget: 4,
  maxConsecutiveDays: 2,
  windowStart: '18:00',
  windowEnd: '22:00',
  weekdays: [
    { dayOfWeek: 1, preference: 'if_free' },
    { dayOfWeek: 5, preference: 'excluded' },
  ],
}

async function runScheduleConstraintCli(args: string[], response: Response) {
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

describe('schedule constraints get', () => {
  it('returns an explicit null when no constraints are saved', async () => {
    const responseBody = { constraint: null }

    expect(
      await runScheduleConstraintCli(
        ['schedule', 'constraints', 'get', SCHEDULE_ID],
        new Response(JSON.stringify(responseBody), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: `/api/schedule/events/${SCHEDULE_ID}/constraints`,
          query: {},
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })
})

describe('schedule constraints set', () => {
  it('sends and prints the complete constraint object and violations', async () => {
    const responseBody = {
      constraint: CONSTRAINTS,
      constraintViolations: [],
    }

    expect(
      await runScheduleConstraintCli(
        [
          'schedule',
          'constraints',
          'set',
          SCHEDULE_ID,
          '--constraints',
          JSON.stringify(CONSTRAINTS),
        ],
        new Response(JSON.stringify(responseBody), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PUT',
          pathname: `/api/schedule/events/${SCHEDULE_ID}/constraints`,
          query: {},
          body: CONSTRAINTS,
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })

  it('rejects constraints that fail the shared schema before sending a request', async () => {
    const invalidConstraints = { ...CONSTRAINTS, windowEnd: null }

    expect(
      await runScheduleConstraintCli(
        [
          'schedule',
          'constraints',
          'set',
          SCHEDULE_ID,
          '--constraints',
          JSON.stringify(invalidConstraints),
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [
        [
          'Error: windowEnd: windowStart and windowEnd must both be set or both be null\n',
        ],
      ],
      stdout: [],
    })
  })
})

describe('schedule constraints delete', () => {
  it('deletes the constraints for a schedule event', async () => {
    expect(
      await runScheduleConstraintCli(
        ['schedule', 'constraints', 'delete', SCHEDULE_ID],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'DELETE',
          pathname: `/api/schedule/events/${SCHEDULE_ID}/constraints`,
          query: {},
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [
        [`${JSON.stringify({ deleted: true, id: SCHEDULE_ID }, null, 2)}\n`],
      ],
    })
  })
})

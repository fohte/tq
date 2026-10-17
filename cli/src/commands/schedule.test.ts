import {
  makeScheduleEvent,
  makeTimeBlock,
} from 'api/routes/schedule-test-fixtures'
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

async function runScheduleCli(args: string[], response: Response) {
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

async function runScheduleEventsCreateHelp() {
  const stdout = spyStdout()
  const exitCode = await runCli(
    ['schedule', 'events', 'create', '--help'],
    fetch,
    fakeStdin(true),
  )

  return { exitCode, stdout: stdout.mock.calls }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('schedule time blocks list', () => {
  it('requires and sends an explicit timezone offset', async () => {
    const blocks: unknown[] = []

    expect(
      await runScheduleCli(
        [
          'schedule',
          'time-blocks',
          'list',
          '2026-12-18',
          '2026-12-19',
          '--tz-offset',
          '-240',
        ],
        new Response(JSON.stringify(blocks), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/schedule/time-blocks',
          query: {
            startDate: '2026-12-18',
            endDate: '2026-12-19',
            tzOffset: '-240',
          },
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [['[]\n']],
    })
  })

  it('rejects a missing timezone offset before sending a request', async () => {
    expect(
      await runScheduleCli(
        ['schedule', 'time-blocks', 'list', '2026-12-18', '2026-12-19'],
        new Response('[]', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [['Error: tzOffset must be an integer number of minutes\n']],
      stdout: [],
    })
  })

  it('rejects date ranges longer than 42 days before sending a request', async () => {
    expect(
      await runScheduleCli(
        [
          'schedule',
          'time-blocks',
          'list',
          '2099-01-01',
          '2099-02-12',
          '--tz-offset',
          '0',
        ],
        new Response('[]', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [
        [
          'Error: endDate: Date range must be chronological and no longer than 42 days\n',
        ],
      ],
      stdout: [],
    })
  })
})

describe('schedule time blocks create', () => {
  it('creates an auto-scheduled block for a task number', async () => {
    const taskId = '42'
    const block = makeTimeBlock({
      taskId,
      startTime: '2026-12-18T08:30:00.000Z',
      endTime: '2026-12-18T09:15:00.000Z',
      isAutoScheduled: true,
    })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'time-blocks',
          'create',
          taskId,
          '2026-12-18T08:30:00.000Z',
          '2026-12-18T09:15:00.000Z',
          '--auto-scheduled',
        ],
        new Response(JSON.stringify(block), { status: 201 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/schedule/time-blocks',
          query: {},
          body: {
            taskId,
            startTime: '2026-12-18T08:30:00.000Z',
            endTime: '2026-12-18T09:15:00.000Z',
            isAutoScheduled: true,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(block, null, 2)}\n`]],
    })
  })

  it('creates an auto-scheduled block for a task UUID', async () => {
    const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const block = makeTimeBlock({
      taskId,
      startTime: '2026-12-18T08:30:00.000Z',
      endTime: '2026-12-18T09:15:00.000Z',
      isAutoScheduled: true,
    })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'time-blocks',
          'create',
          taskId,
          '2026-12-18T08:30:00.000Z',
          '2026-12-18T09:15:00.000Z',
          '--auto-scheduled',
        ],
        new Response(JSON.stringify(block), { status: 201 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/schedule/time-blocks',
          query: {},
          body: {
            taskId,
            startTime: '2026-12-18T08:30:00.000Z',
            endTime: '2026-12-18T09:15:00.000Z',
            isAutoScheduled: true,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(block, null, 2)}\n`]],
    })
  })

  it('rejects conflicting auto-scheduled and manual flags before sending a request', async () => {
    const taskId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

    expect(
      await runScheduleCli(
        [
          'schedule',
          'time-blocks',
          'create',
          taskId,
          '2026-12-18T08:30:00.000Z',
          '2026-12-18T09:15:00.000Z',
          '--auto-scheduled',
          '--manual',
        ],
        new Response('{}', { status: 201 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [['Error: Use only one of --auto-scheduled or --manual\n']],
      stdout: [],
    })
  })
})

describe('schedule constraints check', () => {
  it('sends a JSON draft to the constraint-check API', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const draft = {
      occurrenceChange: {
        originalDate: '2030-05-09',
        date: '2030-05-10',
      },
    }
    const responseBody = { constraintViolations: [] }

    expect(
      await runScheduleCli(
        [
          'schedule',
          'constraints',
          'check',
          id,
          '2030-05-06',
          '2030-05-12',
          '--draft',
          JSON.stringify(draft),
        ],
        new Response(JSON.stringify(responseBody), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: `/api/schedule/events/${id}/constraint-check`,
          query: {},
          body: {
            startDate: '2030-05-06',
            endDate: '2030-05-12',
            draft,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })

  it('rejects malformed draft JSON before sending a request', async () => {
    expect(
      await runScheduleCli(
        [
          'schedule',
          'constraints',
          'check',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '2030-05-06',
          '2030-05-12',
          '--draft',
          '{',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [
        [
          `Error: Invalid --draft JSON: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n`,
        ],
      ],
      stdout: [],
    })
  })

  it('rejects schema-invalid draft values before sending a request', async () => {
    expect(
      await runScheduleCli(
        [
          'schedule',
          'constraints',
          'check',
          'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '2030-05-06',
          '2030-05-12',
          '--draft',
          '{"constraints":{"weeklyMin":8}}',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [
        [
          'Error: constraints.weeklyMin: Too big: expected number to be <=7; constraints.weeklyMax: Invalid input: expected number, received undefined; constraints.weeklyTarget: Invalid input: expected number, received undefined; constraints.maxConsecutiveDays: Invalid input: expected number, received undefined; constraints.windowStart: Invalid input: expected string, received undefined; constraints.windowEnd: Invalid input: expected string, received undefined; constraints.weekdays: Invalid input: expected array, received undefined\n',
        ],
      ],
      stdout: [],
    })
  })
})

describe('schedule events create', () => {
  it('describes schedule dates and recurrence in CLI help', async () => {
    const expectedHelp = [
      'Usage: tq schedule events create [options] <title> <startDate> <startTime> <endTime>',
      '',
      'Create a schedule event starting on the required local startDate (YYYY-MM-DD).',
      'startTime and endTime are local HH:MM times; if endTime is earlier than',
      'startTime, it ends the following day. remindBeforeMinutes optionally sends a',
      'push notification that many minutes before each occurrence starts. Without',
      'recurrence, the event appears only on startDate. For recurrence, daily and',
      'custom rules appear every day starting on startDate, weekly rules use daysOfWeek',
      '(0 = Sunday through 6 = Saturday), and monthly rules use dayOfMonth. interval is',
      'stored but does not affect schedule event dates yet.',
      '',
      'Options:',
      '  --recurrence-type <type>          Recurrence rule type',
      '                                    (daily/weekly/monthly/custom); requires',
      '                                    --recurrence-interval',
      '  --recurrence-interval <n>         Recurrence interval (stored but currently',
      '                                    ignored when expanding schedule event dates)',
      '  --recurrence-days-of-week <days>  Comma-separated days of week for a weekly',
      '                                    rule (0=Sunday..6=Saturday)',
      '  --recurrence-day-of-month <day>   Day of month (1-31) for a monthly rule',
      '  --remind-before-minutes <value>   Minutes before an occurrence starts to send',
      '                                    a push reminder.',
      '  --context <value>                 Context (choices: "work", "personal")',
      '  --color <value>                   Color',
      '  -h, --help                        display help for command',
      '',
    ].join('\n')

    expect(await runScheduleEventsCreateHelp()).toEqual({
      exitCode: 0,
      stdout: [[expectedHelp]],
    })
  })

  it('creates an event without recurrence flags', async () => {
    const responseBody = makeScheduleEvent({ title: 'Draft agenda' })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'create',
          'Draft agenda',
          '2026-12-18',
          '08:45',
          '09:15',
        ],
        new Response(JSON.stringify(responseBody), { status: 201 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/schedule/events',
          query: {},
          body: {
            title: 'Draft agenda',
            startDate: '2026-12-18',
            startTime: '08:45',
            endTime: '09:15',
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })

  it('creates an event with recurrence flags', async () => {
    const responseBody = makeScheduleEvent({
      title: 'Draft agenda',
      recurrence: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        type: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3, 5],
        dayOfMonth: null,
      },
    })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'create',
          'Draft agenda',
          '2026-12-18',
          '08:45',
          '09:15',
          '--recurrence-type',
          'weekly',
          '--recurrence-interval',
          '1',
          '--recurrence-days-of-week',
          '1,3,5',
        ],
        new Response(JSON.stringify(responseBody), { status: 201 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/schedule/events',
          query: {},
          body: {
            title: 'Draft agenda',
            startDate: '2026-12-18',
            startTime: '08:45',
            endTime: '09:15',
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [1, 3, 5],
            },
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })

  it('sets a reminder lead time', async () => {
    const responseBody = makeScheduleEvent({
      title: 'Draft agenda',
      remindBeforeMinutes: 45,
    })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'create',
          'Draft agenda',
          '2026-12-18',
          '08:45',
          '09:15',
          '--remind-before-minutes',
          '45',
        ],
        new Response(JSON.stringify(responseBody), { status: 201 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/schedule/events',
          query: {},
          body: {
            title: 'Draft agenda',
            startDate: '2026-12-18',
            startTime: '08:45',
            endTime: '09:15',
            remindBeforeMinutes: 45,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })

  it('rejects an incomplete recurrence rule before making a request', async () => {
    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'create',
          'Draft agenda',
          '2026-12-18',
          '08:45',
          '09:15',
          '--recurrence-type',
          'weekly',
        ],
        new Response('{}', { status: 201 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [['Error: Invalid input: expected number, received NaN\n']],
      stdout: [],
    })
  })
})

describe('schedule events update', () => {
  it('sends dryRun when previewing a schedule update', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const preview = {
      range: { startDate: '2037-04-11', endDate: '2037-05-22' },
      changes: [
        {
          before: {
            date: '2037-04-11',
            originalDate: '2037-04-11',
            startTime: '08:30',
            endTime: '09:30',
            skipped: false,
          },
          after: {
            date: '2037-04-11',
            originalDate: '2037-04-11',
            startTime: '10:00',
            endTime: '11:00',
            skipped: false,
          },
        },
      ],
      deletedOverrides: [],
    }

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'update',
          id,
          '--effective-from',
          '2037-04-11',
          '--start-time',
          '10:00',
          '--end-time',
          '11:00',
          '--dry-run',
        ],
        new Response(JSON.stringify(preview), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/schedule/events/${id}`,
          query: {},
          body: {
            effectiveFrom: '2037-04-11',
            startTime: '10:00',
            endTime: '11:00',
            dryRun: true,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(preview, null, 2)}\n`]],
    })
  })

  it('applies recurrence and end date changes from an effective date', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const updated = makeScheduleEvent({
      id,
      startTime: '09:30',
      endTime: '10:00',
      endDate: '2026-12-20',
      remindBeforeMinutes: 90,
      recurrence: {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        type: 'weekly',
        interval: 1,
        daysOfWeek: [0],
        dayOfMonth: null,
      },
    })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'update',
          id,
          '--effective-from',
          '2026-12-20',
          '--start-time',
          '09:30',
          '--end-time',
          '10:00',
          '--recurrence-type',
          'weekly',
          '--recurrence-interval',
          '1',
          '--recurrence-days-of-week',
          '0',
          '--end-date',
          '2026-12-20',
          '--remind-before-minutes',
          '90',
        ],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/schedule/events/${id}`,
          query: {},
          body: {
            effectiveFrom: '2026-12-20',
            startTime: '09:30',
            endTime: '10:00',
            endDate: '2026-12-20',
            remindBeforeMinutes: 90,
            recurrence: {
              type: 'weekly',
              interval: 1,
              daysOfWeek: [0],
            },
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })

  it('clears recurrence, end date, and reminder from an effective date', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    const updated = makeScheduleEvent({ id })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'update',
          id,
          '--effective-from',
          '2026-12-20',
          '--no-recurrence',
          '--clear-end-date',
          '--clear-reminder',
        ],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/schedule/events/${id}`,
          query: {},
          body: {
            effectiveFrom: '2026-12-20',
            recurrence: null,
            endDate: null,
            remindBeforeMinutes: null,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })

  it('rejects conflicting reminder flags before sending a request', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

    expect(
      await runScheduleCli(
        [
          'schedule',
          'events',
          'update',
          id,
          '--clear-reminder',
          '--remind-before-minutes',
          '45',
        ],
        new Response('{}', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [
        [
          'Error: Use only one of --clear-reminder or --remind-before-minutes\n',
        ],
      ],
      stdout: [],
    })
  })
})

describe('schedule events delete', () => {
  it('deletes the selected schedule', async () => {
    const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

    expect(
      await runScheduleCli(
        ['schedule', 'events', 'delete', id],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'DELETE',
          pathname: `/api/schedule/events/${id}`,
          query: {},
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify({ deleted: true, id }, null, 2)}\n`]],
    })
  })
})

describe('schedule time blocks update', () => {
  it('updates an end time and marks the block manual', async () => {
    const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
    const updated = makeTimeBlock({
      id,
      taskId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      startTime: '2026-12-18T08:30:00.000Z',
      endTime: '2026-12-18T09:45:00.000Z',
      isAutoScheduled: false,
      updatedAt: '2026-12-18T00:01:00.000Z',
    })

    expect(
      await runScheduleCli(
        [
          'schedule',
          'time-blocks',
          'update',
          id,
          '--end-time',
          '2026-12-18T09:45:00.000Z',
          '--manual',
        ],
        new Response(JSON.stringify(updated), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: `/api/schedule/time-blocks/${id}`,
          query: {},
          body: {
            endTime: '2026-12-18T09:45:00.000Z',
            isAutoScheduled: false,
          },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })
})

describe('schedule time blocks delete', () => {
  it('deletes the selected block', async () => {
    const id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

    expect(
      await runScheduleCli(
        ['schedule', 'time-blocks', 'delete', id],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'DELETE',
          pathname: `/api/schedule/time-blocks/${id}`,
          query: {},
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify({ deleted: true, id }, null, 2)}\n`]],
    })
  })
})

describe('schedule events list', () => {
  it('accepts an inclusive 42-day date range', async () => {
    expect(
      await runScheduleCli(
        ['schedule', 'events', 'list', '2099-01-01', '2099-02-11'],
        new Response('[]', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/schedule/events',
          query: { startDate: '2099-01-01', endDate: '2099-02-11' },
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [['[]\n']],
    })
  })

  it('rejects date ranges longer than 42 days before sending a request', async () => {
    expect(
      await runScheduleCli(
        ['schedule', 'events', 'list', '2099-01-01', '2099-02-12'],
        new Response('[]', { status: 200 }),
      ),
    ).toEqual({
      exitCode: 1,
      requests: [],
      stderr: [
        [
          'Error: endDate: Date range must be chronological and no longer than 42 days\n',
        ],
      ],
      stdout: [],
    })
  })

  it('requests schedule events for the supplied date range', async () => {
    const instances: unknown[] = []

    expect(
      await runScheduleCli(
        ['schedule', 'events', 'list', '2026-12-18', '2026-12-20'],
        new Response(JSON.stringify(instances), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/schedule/events',
          query: { startDate: '2026-12-18', endDate: '2026-12-20' },
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [['[]\n']],
    })
  })
})

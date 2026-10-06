import { makeTimeBlock } from 'api/routes/schedule-test-fixtures'
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

describe('schedule recurring list', () => {
  it('requests expanded recurring instances for the supplied date range', async () => {
    const instances: unknown[] = []

    expect(
      await runScheduleCli(
        ['schedule', 'recurring', 'list', '2026-12-18', '2026-12-20'],
        new Response(JSON.stringify(instances), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/schedule/recurring',
          query: { startDate: '2026-12-18', endDate: '2026-12-20' },
          body: undefined,
        },
      ],
      stderr: [],
      stdout: [['[]\n']],
    })
  })
})

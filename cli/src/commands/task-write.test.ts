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

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function operationSnapshot(
  exitCode: number,
  call: Parameters<typeof request>[0],
) {
  return { exitCode, request: request(call) }
}

function operationOutputSnapshot(
  exitCode: number,
  call: Parameters<typeof request>[0],
  stdout: unknown,
) {
  return { ...operationSnapshot(exitCode, call), stdout }
}

function operationErrorSnapshot(
  exitCode: number,
  call: Parameters<typeof request>[0],
  stdout: unknown,
  stderr: unknown,
) {
  return { ...operationSnapshot(exitCode, call), stdout, stderr }
}

function commandOutputSnapshot(
  exitCode: number,
  output: Record<string, unknown>,
  stdout: unknown,
  stderr: unknown,
) {
  return { exitCode, ...output, stdout, stderr }
}

function commandHelpSnapshot(
  exitCode: number,
  stdout: unknown,
  stderr: unknown,
) {
  return { exitCode, stdout, stderr }
}

describe('task create', () => {
  it('sends only the title when no optional flags are given and prints the response', async () => {
    const created = { id: 't1', number: 1, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'create', 'New task'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: { title: 'New task' },
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('prints the linkSync summary to stderr when the response includes one', async () => {
    const created = {
      id: 't1',
      number: 1,
      title: 'New task',
      linkSync: {
        outgoing: [{ number: 76, title: 'Fix bug' }],
        unresolvedRefs: [],
      },
    }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'create', 'New task'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(stderr.mock.calls).toEqual([['Linked tasks:\n  #76 Fix bug\n']])
  })

  it('sends --parent-id as-is, accepting either a task id or number', async () => {
    const created = { id: 't2', number: 2, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'create', 'New task', '--parent-id', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: { title: 'New task', parentId: '42' },
    })
  })

  it('sends --template with the selected description template name', async () => {
    const created = { id: 't2', number: 2, title: 'Draft proposal' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'Draft proposal',
        '--template',
        'Execution brief',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(operationSnapshot(exitCode, calls[0])).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/tasks',
        query: {},
        body: { title: 'Draft proposal', template: 'Execution brief' },
      },
    })
  })

  it('uses TQ_CONTEXT as the default context when --context is omitted', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const created = { id: 't1', number: 1, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'create', 'New task'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: { title: 'New task', context: 'work' },
    })
  })

  it('prefers an explicit --context over TQ_CONTEXT', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const created = { id: 't1', number: 1, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--context',
        'personal',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: { title: 'New task', context: 'personal' },
    })
  })

  it('rejects an invalid TQ_CONTEXT before making any fetch call', async () => {
    vi.stubEnv('TQ_CONTEXT', 'nonsense')
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 201 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'create', 'New task'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
  })

  it('splits --labels into a label name array', async () => {
    const created = { id: 't1', number: 1, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--labels',
        'dev/tq, dev/meshi',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: { title: 'New task', labels: ['dev/tq', 'dev/meshi'] },
    })
  })

  it('splits --blocked-by into task ids/numbers and GitHub URLs', async () => {
    const created = { id: 't1', number: 1, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--blocked-by',
        '312, https://github.com/example-owner/example-repo/issues/17, 315',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: {
        title: 'New task',
        blockedBy: [
          '312',
          'https://github.com/example-owner/example-repo/issues/17',
          '315',
        ],
      },
    })
  })

  it('assembles the --recurrence-* flags into a recurrenceRule object', async () => {
    const created = { id: 't1', number: 1, title: 'New task' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--recurrence-type',
        'weekly',
        '--recurrence-interval',
        '2',
        '--recurrence-days-of-week',
        '1, 3',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks',
      query: {},
      body: {
        title: 'New task',
        recurrenceRule: { type: 'weekly', interval: 2, daysOfWeek: [1, 3] },
      },
    })
  })

  it('rejects --recurrence-type without --recurrence-interval before making any fetch call', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 201 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--recurrence-type',
        'weekly',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
    expect(stderr.mock.calls).toEqual([
      ['Error: Invalid input: expected number, received NaN\n'],
    ])
  })

  it('rejects --recurrence-interval without --recurrence-type before making any fetch call', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 201 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--recurrence-interval',
        '2',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
    expect(stderr.mock.calls).toEqual([
      [
        'Error: Invalid option: expected one of "daily"|"weekly"|"monthly"|"custom"\n',
      ],
    ])
  })
})

describe('task update', () => {
  it('sends only the given flag as the request body', async () => {
    const updated = { id: 't1', number: 1, title: 'Updated title' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--title', 'Updated title'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: { title: 'Updated title' },
    })
  })

  it('prints the linkSync summary to stderr when the response includes one', async () => {
    const updated = {
      id: 't1',
      number: 1,
      title: 'Updated title',
      linkSync: {
        outgoing: [{ number: 76, title: 'Fix bug' }],
        unresolvedRefs: [],
      },
    }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--title', 'Updated title'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(stderr.mock.calls).toEqual([['Linked tasks:\n  #76 Fix bug\n']])
  })

  it('rejects the call before making any fetch call when no flags are given', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
  })

  it('ignores TQ_CONTEXT — an update never touches context unless --context is given', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const updated = { id: 't1', number: 1, title: 'Updated title' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--title', 'Updated title'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: { title: 'Updated title' },
    })
  })

  it('splits --blocked-by into task ids/numbers and GitHub URLs', async () => {
    const updated = { id: 't1', number: 1 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'update',
        '42',
        '--blocked-by',
        '312, https://github.com/example-owner/example-repo/issues/17, 315',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: {
        blockedBy: [
          '312',
          'https://github.com/example-owner/example-repo/issues/17',
          '315',
        ],
      },
    })
  })

  it('sends an empty blockedBy array to clear all blockers', async () => {
    const updated = { id: 't1', number: 1 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--blocked-by', ''],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: { blockedBy: [] },
    })
  })

  it('splits --labels into a label name array', async () => {
    const updated = { id: 't1', number: 1 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'update',
        '42',
        '--labels',
        'dev/tq, dev/meshi',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: { labels: ['dev/tq', 'dev/meshi'] },
    })
  })

  it('sends an empty labels array to clear all labels', async () => {
    const updated = { id: 't1', number: 1 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--labels', ''],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: { labels: [] },
    })
  })

  it('assembles the --recurrence-* flags into a recurrenceRule object', async () => {
    const updated = { id: 't1', number: 1 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'update',
        '42',
        '--recurrence-type',
        'monthly',
        '--recurrence-interval',
        '1',
        '--recurrence-day-of-month',
        '15',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: {
        recurrenceRule: { type: 'monthly', interval: 1, dayOfMonth: 15 },
      },
    })
  })

  it('sends a null recurrenceRule to clear it when --no-recurrence is given', async () => {
    const updated = { id: 't1', number: 1 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--no-recurrence'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42',
      query: {},
      body: { recurrenceRule: null },
    })
  })

  it('reports the API error when --blocked-by would create a cycle', async () => {
    const { fetchStub, calls } = captureFetch(
      () =>
        new Response(
          JSON.stringify({ error: 'Circular blocking relationship detected' }),
          { status: 409 },
        ),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'update', '42', '--blocked-by', '7'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls).toHaveLength(1)
    expect(stderr.mock.calls).toEqual([
      ['Error: Circular blocking relationship detected (HTTP 409)\n'],
    ])
  })
})

describe('task delete', () => {
  const task = {
    id: '11111111-1111-4111-8111-111111111111',
    number: 987654321,
    title: 'Imaginary cleanup task',
  }
  const warnings = [
    "Permanent deletion removes this task, its pages, and its comments. Child tasks are reparented to this task's parent.",
    'To cancel work while keeping its task number and comments, use task complete <id> --reason not_planned.',
  ]

  it('shows the resolved task and deletion impact without sending DELETE', async () => {
    const responses = [new Response(JSON.stringify(task), { status: 200 })]
    const { fetchStub, calls } = captureFetch(
      () => responses.shift() ?? new Response(null, { status: 500 }),
    )
    const write = spyStdout()
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'delete', String(task.number)],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      commandOutputSnapshot(
        exitCode,
        { requests: calls.map(request) },
        write.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: `/api/tasks/${String(task.number)}`,
          query: {},
          body: undefined,
        },
      ],
      stdout: [
        [
          `${JSON.stringify(
            {
              deleted: false,
              task,
              warnings,
              confirmWith: `tq task delete ${String(task.number)} --confirm-delete ${String(task.number)}`,
            },
            null,
            2,
          )}\n`,
        ],
      ],
      stderr: [],
    })
  })

  it('does not send DELETE when the confirmation resolves to another task', async () => {
    const otherTask = {
      id: '22222222-2222-4222-8222-222222222222',
      number: 987654322,
      title: 'Imaginary separate task',
    }
    const responses = [
      new Response(JSON.stringify(task), { status: 200 }),
      new Response(JSON.stringify(otherTask), { status: 200 }),
    ]
    const { fetchStub, calls } = captureFetch(
      () => responses.shift() ?? new Response(null, { status: 500 }),
    )
    const stderr = spyStderr()
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'delete',
        String(task.number),
        '--confirm-delete',
        otherTask.id,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      commandOutputSnapshot(
        exitCode,
        { requests: calls.map(request) },
        write.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 1,
      requests: [
        {
          method: 'GET',
          pathname: `/api/tasks/${String(task.number)}`,
          query: {},
          body: undefined,
        },
        {
          method: 'GET',
          pathname: `/api/tasks/${otherTask.id}`,
          query: {},
          body: undefined,
        },
      ],
      stdout: [],
      stderr: [
        [
          `Error: --confirm-delete resolved to task #${String(otherTask.number)} "${otherTask.title}", not task #${String(task.number)} "${task.title}". No task was deleted.\n${warnings.join('\n')}\n`,
        ],
      ],
    })
  })

  it('does not send DELETE when the confirmation lookup fails', async () => {
    const responses = [
      new Response(JSON.stringify(task), { status: 200 }),
      Response.json({ error: 'Task not found' }, { status: 404 }),
    ]
    const { fetchStub, calls } = captureFetch(
      () => responses.shift() ?? new Response(null, { status: 500 }),
    )
    const stderr = spyStderr()
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'delete',
        String(task.number),
        '--confirm-delete',
        '987654323',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      commandOutputSnapshot(
        exitCode,
        { requests: calls.map(request) },
        write.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 1,
      requests: [
        {
          method: 'GET',
          pathname: `/api/tasks/${String(task.number)}`,
          query: {},
          body: undefined,
        },
        {
          method: 'GET',
          pathname: '/api/tasks/987654323',
          query: {},
          body: undefined,
        },
      ],
      stdout: [],
      stderr: [['Error: Task not found (HTTP 404)\n']],
    })
  })

  it('deletes the resolved task when the confirmation matches by UUID and number', async () => {
    const refreshedTask = {
      ...task,
      number: task.number + 1,
      title: 'Imaginary refreshed cleanup task',
    }
    const responses = [
      new Response(JSON.stringify(task), { status: 200 }),
      new Response(JSON.stringify(refreshedTask), { status: 200 }),
      new Response(null, { status: 204 }),
    ]
    const { fetchStub, calls } = captureFetch(
      () => responses.shift() ?? new Response(null, { status: 500 }),
    )
    const write = spyStdout()
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'delete',
        String(task.number),
        '--confirm-delete',
        task.id,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      commandOutputSnapshot(
        exitCode,
        { requests: calls.map(request) },
        write.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: `/api/tasks/${String(task.number)}`,
          query: {},
          body: undefined,
        },
        {
          method: 'GET',
          pathname: `/api/tasks/${task.id}`,
          query: {},
          body: undefined,
        },
        {
          method: 'DELETE',
          pathname: `/api/tasks/${task.id}`,
          query: {},
          body: undefined,
        },
      ],
      stdout: [
        [
          `${JSON.stringify(
            { deleted: true, task: refreshedTask, warnings },
            null,
            2,
          )}\n`,
        ],
      ],
      stderr: [],
    })
  })
})

describe('task reopen', () => {
  it('sets a task to todo', async () => {
    const updated = {
      id: '11111111-1111-4111-8111-111111111111',
      status: 'todo',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'reopen', '987654321'],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      operationOutputSnapshot(exitCode, calls[0], write.mock.calls),
    ).toEqual({
      exitCode: 0,
      request: {
        method: 'PATCH',
        pathname: '/api/tasks/987654321/status',
        query: {},
        body: { status: 'todo' },
      },
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })
})

describe('task parent', () => {
  it('sends the given parentId as the request body and prints the response', async () => {
    const updated = {
      id: 't1',
      number: 1,
      parentId: '22222222-2222-4222-8222-222222222222',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'parent',
        '42',
        '22222222-2222-4222-8222-222222222222',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      operationOutputSnapshot(exitCode, calls[0], write.mock.calls),
    ).toEqual({
      exitCode: 0,
      request: {
        method: 'PATCH',
        pathname: '/api/tasks/42/parent',
        query: {},
        body: { parentId: '22222222-2222-4222-8222-222222222222' },
      },
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })

  it('sends parentId: null when the positional is omitted', async () => {
    const updated = { id: 't1', number: 1, parentId: null }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'parent', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'PATCH',
      pathname: '/api/tasks/42/parent',
      query: {},
      body: { parentId: null },
    })
  })
})

describe('task complete', () => {
  it('shows the configured reason and duplicate target options in help', async () => {
    const write = spyStdout()

    const exitCode = await runCli(
      ['task', 'complete', '--help'],
      fetch,
      fakeStdin(true),
    )

    expect(`${String(exitCode)}\n${String(write.mock.calls[0]?.[0])}`).toBe(
      `0
Usage: tq task complete [options] <id>

Complete a task. LLM authors must choose --reason explicitly.

Options:
  --reason <reason>        Reason for closing: completed for work that is done,
                           not_planned when work will not be done, or duplicate
                           when another task tracks the same work. Required for
                           LLM authors. (choices: "completed", "not_planned",
                           "duplicate")
  --duplicate-of <taskId>  Task id or number this task is a duplicate of (only
                           used when --reason duplicate)
  -h, --help               display help for command
`,
    )
  })

  it('lets the API reject an LLM completion without a reason', async () => {
    const { fetchStub, calls } = captureFetch(() =>
      Response.json(
        {
          error:
            'LLM-authored completions require an explicit statusReason: "completed" for work that is done, "not_planned" when work will not be done, or "duplicate" when another task tracks the same work.',
        },
        { status: 400 },
      ),
    )
    const stderr = spyStderr()
    const stdout = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        '--author',
        'fictional-agent',
        'task',
        'complete',
        '987654321',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      operationErrorSnapshot(
        exitCode,
        calls[0],
        stdout.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 1,
      request: {
        method: 'POST',
        pathname: '/api/tasks/987654321/complete',
        query: {},
        body: {},
      },
      stdout: [],
      stderr: [
        [
          'Error: LLM-authored completions require an explicit statusReason: "completed" for work that is done, "not_planned" when work will not be done, or "duplicate" when another task tracks the same work. (HTTP 400)\n',
        ],
      ],
    })
  })

  it('sends the parsed --reason as statusReason', async () => {
    const completed = {
      id: 't1',
      number: 1,
      status: 'completed',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(completed), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'complete', '42', '--reason', 'duplicate'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks/42/complete',
      query: {},
      body: { statusReason: 'duplicate' },
    })
  })

  it('sends --duplicate-of task number as duplicateOfTaskId', async () => {
    const completed = {
      id: 't1',
      number: 1,
      status: 'completed',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(completed), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'complete', '42', '--duplicate-of', '43'],
      fetchStub,
      fakeStdin(true),
    )

    const getActual = () => ({ exitCode, request: request(calls[0]) })

    expect(getActual()).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/tasks/42/complete',
        query: {},
        body: {
          duplicateOfTaskId: '43',
        },
      },
    })
  })

  it('sends --reason duplicate and --duplicate-of together', async () => {
    const completed = {
      id: 't1',
      number: 1,
      status: 'completed',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(completed), { status: 200 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'complete',
        '42',
        '--reason',
        'duplicate',
        '--duplicate-of',
        '22222222-2222-4222-8222-222222222222',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(operationSnapshot(exitCode, calls[0])).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/tasks/42/complete',
        query: {},
        body: {
          statusReason: 'duplicate',
          duplicateOfTaskId: '22222222-2222-4222-8222-222222222222',
        },
      },
    })
  })

  it('rejects an invalid --reason', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'complete', '42', '--reason', 'bogus'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).not.toBe(0)
  })
})

describe('task help', () => {
  it('documents task states, closure reasons, and command migrations', async () => {
    const stdout = spyStdout()
    const stderr = spyStderr()

    const exitCode = await runCli(['task', '--help'], fetch, fakeStdin(true))

    expect(
      commandHelpSnapshot(exitCode, stdout.mock.calls, stderr.mock.calls),
    ).toEqual({
      exitCode: 0,
      stdout: [
        [
          `Usage: tq task [options] [command]

Manage tasks. Status is todo or completed. Closure reasons are completed for
work that is done, not_planned when work will not be done, or duplicate when
another task tracks the same work. Use task complete --reason to close or task
reopen to return to todo.

Options:
  -h, --help                display help for command

Commands:
  list [options]            List tasks by status, project, parent, context, or
                            other supported filters, including an optional
                            free-text query. Descriptions are omitted by
                            default; set full to include them.
  get <id>                  Get a task's full detail: attributes, recurrence
                            rule, time blocks, page metadata and short previews,
                            checklist trees and leaf-item progress, linked tasks
                            (mentions or pasted task URLs, as
                            links.outgoing/links.incoming), labels, and nested
                            subtask summaries. Subtask descriptions are omitted;
                            use task_get (or CLI: task get) on a subtask to
                            retrieve its description. Page bodies are available
                            through page_get.
  url <id>                  Print a task's web URL.
  create [options] <title>  Create a task
  update [options] <id>     Update a task
  delete [options] <id>     Show the task and deletion impact; use
                            --confirm-delete <id> to proceed only for that task
  reopen <id>               Return a completed task to todo
  parent <id> [parentId]    Set or clear a task's parent (omit parentId to clear
                            it)
  complete [options] <id>   Complete a task. LLM authors must choose --reason
                            explicitly.
  search [options] [query]  Search tasks using the TQ search bar query syntax.
                            The q string matches title, description, and page
                            content, and accepts filter tokens that combine with
                            free text: is:todo|completed (repeat is: to match
                            multiple statuses),
                            reason:completed|not_planned|duplicate, label:<name>
                            (also matches descendants under a /-separated path),
                            context:work|personal,
                            commitment:inbox|active|someday,
                            has:pages|comments|no-children|blockers|no-blockers|follow-up-due|resolved-wait,
                            parent:<uuid|number>|root, project:<uuid|title>, and
                            sort:due|created|updated. has:follow-up-due matches
                            tasks with an unresolved wait whose follow-up date
                            is today or earlier in the client timezone.
                            has:resolved-wait matches tasks with a resolved wait
                            that has not been acknowledged and is available
                            through q. Search filters with corresponding fields
                            in the task search schema can also be sent as
                            explicit parameters. For example, q: "is:todo
                            label:example context:work planning" finds matching
                            todo tasks whose title, description, or pages
                            mention planning. Task descriptions are omitted from
                            results by default; set full to include them.
  activity <id>             Get the activity history of a task.
  sessions <id>             List agent sessions linked to a task.
  from-github <url>         Create a task from a GitHub issue or pull request
                            URL
  help [command]            display help for command
`,
        ],
      ],
      stderr: [],
    })
  })
})

describe('task from-github', () => {
  it('sends the url and prints the response', async () => {
    const created = {
      created: true,
      task: { id: 't1', number: 1, title: 'From GitHub' },
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'from-github',
        'https://github.com/owner/repo/issues/1',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'POST',
      pathname: '/api/tasks/from-github',
      query: {},
      body: { url: 'https://github.com/owner/repo/issues/1' },
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })
})

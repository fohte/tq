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

function cliOutcome(
  exitCode: number,
  calls: ReturnType<typeof captureFetch>['calls'],
  output: ReturnType<typeof spyStdout>,
) {
  return {
    exitCode,
    requests: calls.map(request),
    stdout: output.mock.calls,
  }
}

function cliErrorOutcome(
  exitCode: number,
  calls: ReturnType<typeof captureFetch>['calls'],
  errors: ReturnType<typeof spyStderr>,
) {
  return {
    exitCode,
    requests: calls.map(request),
    errors: errors.mock.calls,
  }
}

describe('task list', () => {
  it('sends schema-derived flags and prints the response', async () => {
    const tasks = [
      { id: 'task-example', number: 1, title: 'Example', status: 'todo' },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--status', 'todo'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: { view: 'row', context: 'all', status: 'todo', limit: '20' },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(tasks, null, 2)}\n`]],
    })
  })

  it('sends task date filters to the API', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'list',
        '--date-from',
        '2026-03-16',
        '--date-to',
        '2026-03-19',
        '--due-to',
        '2026-03-18',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'row',
            context: 'all',
            status: 'todo',
            dateFrom: '2026-03-16',
            dateTo: '2026-03-19',
            dueTo: '2026-03-18',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('keeps the query and matched-text options', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'list',
        '--q',
        'planning',
        '--include-match',
        'true',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'row',
            context: 'all',
            status: 'todo',
            q: 'planning',
            includeMatch: 'true',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('sends mixed task identifiers and the strict ancestor flag', async () => {
    const ids = ['00000000-0000-4000-8000-000000000001', '42']
    const tasks = [{ id: ids[0], number: 42, title: 'Selected task' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'list',
        '--ids',
        ids.join(','),
        '--include-ancestors',
        'true',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'row',
            context: 'all',
            status: 'todo',
            ids,
            includeAncestors: 'true',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(tasks, null, 2)}\n`]],
    })
  })

  it('sends a task number as the parent filter', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--parent-id', '731'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'row',
            context: 'all',
            status: 'todo',
            parentId: '731',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('sends a task number as the descendant filter', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--descendant-of', '731'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'row',
            context: 'all',
            status: 'todo',
            descendantOf: '731',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('rejects an invalid include-ancestors value without making a request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--include-ancestors', 'sometimes'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliErrorOutcome(exitCode, calls, stderr)).toEqual({
      exitCode: 1,
      requests: [],
      errors: [
        [
          'error: option \'--include-ancestors <value>\' argument \'sometimes\' is invalid. Invalid option: expected one of "true"|"false"\n',
        ],
      ],
    })
  })

  it('requests row responses by default', async () => {
    const tasks = [
      {
        id: 'task-example',
        number: 1,
        title: 'Example',
        status: 'todo',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: { view: 'row', context: 'all', status: 'todo', limit: '20' },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(tasks, null, 2)}\n`]],
    })
  })

  it('includes descriptions with --full', async () => {
    const tasks = [
      {
        id: 'task-example',
        number: 1,
        title: 'Example',
        description: 'long body',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--full'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: { view: 'full', context: 'all', status: 'todo', limit: '20' },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(tasks, null, 2)}\n`]],
    })
  })

  it('uses TQ_CONTEXT when --context is omitted', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: { view: 'row', context: 'work', status: 'todo', limit: '20' },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })
})

describe('task get', () => {
  it('prints page metadata and the nested subtree', async () => {
    const task = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      number: 42,
      title: 'Example',
      pages: [
        {
          id: 'page-example',
          taskId: '550e8400-e29b-41d4-a716-446655440000',
          title: 'Notes',
          format: 'markdown',
          sortOrder: 0,
          createdAt: '2031-01-02T03:04:05.000Z',
          updatedAt: '2031-01-02T03:04:05.000Z',
          author: { kind: 'human', agent: null },
          content: 'page body',
        },
      ],
    }
    const child = {
      id: 'child-example',
      parentId: task.id,
      title: 'Child',
    }
    let responseIndex = 0
    const responses = [task, [child]]
    const { fetchStub, calls } = captureFetch(
      () =>
        new Response(JSON.stringify(responses[responseIndex++]), {
          status: 200,
        }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'get', '42'],
      fetchStub,
      fakeStdin(true),
    )

    const taskWithSubtasks = {
      ...task,
      pages: [
        {
          id: 'page-example',
          taskId: task.id,
          title: 'Notes',
          format: 'markdown',
          sortOrder: 0,
          createdAt: '2031-01-02T03:04:05.000Z',
          updatedAt: '2031-01-02T03:04:05.000Z',
          author: { kind: 'human', agent: null },
        },
      ],
      subtasks: [{ ...child, children: [] }],
    }

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks/42',
          query: {},
          body: undefined,
        },
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            limit: 'unlimited',
            descendantOf: task.id,
          },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(taskWithSubtasks, null, 2)}\n`]],
    })
  })
})

describe('task url', () => {
  it('uses the API base URL when no web URL is configured and makes no request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('{}', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'url', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [],
      stdout: [[`${apiUrl}/tasks/42\n`]],
    })
  })

  it('prefers --web-url when both URLs are given', async () => {
    const webUrl = 'http://web.example'
    const { fetchStub, calls } = captureFetch(
      () => new Response('{}', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, '--web-url', webUrl, 'task', 'url', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [],
      stdout: [[`${webUrl}/tasks/42\n`]],
    })
  })

  it('uses TQ_WEB_URL when --web-url is omitted', async () => {
    const webUrl = 'http://web.example'
    vi.stubEnv('TQ_WEB_URL', webUrl)
    const { fetchStub, calls } = captureFetch(
      () => new Response('{}', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'url', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [],
      stdout: [[`${webUrl}/tasks/42\n`]],
    })
  })
})

describe('task activity', () => {
  it('prints the activity items returned by the server', async () => {
    const items = [{ id: 'event-example', type: 'created' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(items), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'activity', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks/42/activity',
          query: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(items, null, 2)}\n`]],
    })
  })
})

describe('task search', () => {
  it('uses TQ_CONTEXT when --context is omitted', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: { view: 'full', context: 'work', status: 'all', limit: '20' },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('maps the query positional and schema flags into the REST request', async () => {
    const results = [{ id: 'task-example', number: 1, title: 'Match' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'hello', '--limit', '5'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            q: 'hello',
            limit: '5',
          },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(results, null, 2)}\n`]],
    })
  })

  it('passes a numeric parent filter in the query to the REST request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'parent:731'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            q: 'parent:731',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('sends numeric parent and descendant filters to the REST request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'search',
        '--parent-id',
        '731',
        '--descendant-of',
        '731',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            parentId: '731',
            descendantOf: '731',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('sends ID and ancestor filters with the positional query', async () => {
    const ids = ['00000000-0000-4000-8000-000000000001', '42']
    const results = [
      { id: ids[0], title: 'Parent', ancestorOnly: true },
      { id: 'task-example', number: 42, title: 'Selected task' },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'search',
        'Selected',
        '--ids',
        ids.join(','),
        '--include-ancestors',
        'true',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            q: 'Selected',
            ids,
            includeAncestors: 'true',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(results, null, 2)}\n`]],
    })
  })

  it('converts hasDue to a REST query string', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', '--has-due', 'true'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            hasDue: 'true',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('converts includeMatch to a REST query string', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response('[]', { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'search',
        'planning',
        '--include-match',
        'true',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            q: 'planning',
            includeMatch: 'true',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [['[]\n']],
    })
  })

  it('omits descriptions by default', async () => {
    const results = [
      {
        id: 'task-example',
        number: 1,
        title: 'Match',
        description: 'long body',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'hello'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            q: 'hello',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [
        [
          `${JSON.stringify(
            [{ id: 'task-example', number: 1, title: 'Match' }],
            null,
            2,
          )}\n`,
        ],
      ],
    })
  })

  it('includes descriptions with --full', async () => {
    const results = [
      {
        id: 'task-example',
        number: 1,
        title: 'Match',
        description: 'long body',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'hello', '--full'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks',
          query: {
            view: 'full',
            context: 'all',
            status: 'all',
            q: 'hello',
            limit: '20',
          },
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(results, null, 2)}\n`]],
    })
  })
})

describe('task sessions', () => {
  it('prints the sessions linked to a task', async () => {
    const sessions = [
      {
        id: 'session-example',
        provider: 'claude_code',
        sessionId: 'session-1',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(sessions), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'sessions', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(cliOutcome(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks/42/agent-sessions',
          query: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify(sessions, null, 2)}\n`]],
    })
  })
})

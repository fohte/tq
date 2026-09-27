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

function commandResult<Fields extends Record<string, unknown>>(
  exitCode: number,
  fields: Fields,
) {
  return { exitCode, ...fields }
}

describe('task list', () => {
  it('sends the schema-derived flags as a query string and prints the response', async () => {
    const tasks = [{ id: 't1', number: 1, title: 'Task one', status: 'todo' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--status', 'todo'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/tasks',
      query: { status: 'todo' },
      body: undefined,
    })
    expect(write.mock.calls).toEqual([[`${JSON.stringify(tasks, null, 2)}\n`]])
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

    expect(
      commandResult(exitCode, {
        request: request(calls[0]),
        output: write.mock.calls,
      }),
    ).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/tasks',
        query: { ids, includeAncestors: 'true' },
        body: undefined,
      },
      output: [[`${JSON.stringify(tasks, null, 2)}\n`]],
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

    expect(
      commandResult(exitCode, {
        requests: calls.map(request),
        errors: stderr.mock.calls,
      }),
    ).toEqual({
      exitCode: 1,
      requests: [],
      errors: [
        [
          'error: option \'--include-ancestors <value>\' argument \'sometimes\' is invalid. Invalid option: expected one of "true"|"false"\n',
        ],
      ],
    })
  })

  it('omits description from the printed output by default', async () => {
    const tasks = [
      {
        id: 't1',
        number: 1,
        title: 'Task one',
        status: 'todo',
        description: 'long body',
      },
    ]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          [{ id: 't1', number: 1, title: 'Task one', status: 'todo' }],
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('includes description in the list output when --full is given', async () => {
    const tasks = [
      { id: 't1', number: 1, title: 'Task one', description: 'long body' },
    ]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'list', '--full'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([[`${JSON.stringify(tasks, null, 2)}\n`]])
  })
})

describe('task get', () => {
  it('fetches the task by id and prints it', async () => {
    const found = { id: 't1', number: 42, title: 'Task one' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(found), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'get', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/tasks/42',
      query: {},
      body: undefined,
    })
    expect(write.mock.calls).toEqual([[`${JSON.stringify(found, null, 2)}\n`]])
  })
})

describe('task url', () => {
  it('falls back to the API base URL when --web-url is not given, without making any fetch call', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'url', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls.length).toBe(0)
    expect(write.mock.calls).toEqual([[`${apiUrl}/tasks/42\n`]])
  })

  it('prefers --web-url over the API base URL when both are given', async () => {
    const webUrl = 'http://web.test'
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, '--web-url', webUrl, 'task', 'url', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls.length).toBe(0)
    expect(write.mock.calls).toEqual([[`${webUrl}/tasks/42\n`]])
  })
})

describe('task activity', () => {
  it('prints the activity items returned by the server', async () => {
    const items = [{ id: 'edit-1', type: 'created' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(items), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'activity', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/tasks/42/activity',
      query: {},
      body: undefined,
    })
    expect(write.mock.calls).toEqual([[`${JSON.stringify(items, null, 2)}\n`]])
  })
})

describe('task search', () => {
  it('combines the positional query with schema-derived flags into the query string', async () => {
    const results = [{ id: 't1', number: 1, title: 'Match' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'hello', '--limit', '5'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/tasks',
      query: { q: 'hello', limit: '5' },
      body: undefined,
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(results, null, 2)}\n`],
    ])
  })

  it('omits description from the printed output by default', async () => {
    const results = [
      { id: 't1', number: 1, title: 'Match', description: 'long body' },
    ]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'hello'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify([{ id: 't1', number: 1, title: 'Match' }], null, 2)}\n`,
      ],
    ])
  })

  it('includes description in search results when --full is given', async () => {
    const results = [
      { id: 't1', number: 1, title: 'Match', description: 'long body' },
    ]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(results), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'search', 'hello', '--full'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(results, null, 2)}\n`],
    ])
  })
})

describe('task sessions', () => {
  it('fetches the sessions linked to a task and prints them', async () => {
    const sessions = [
      { id: 's1', provider: 'claude_code', sessionId: 'sess-1' },
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

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/tasks/42/agent-sessions',
      query: {},
      body: undefined,
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(sessions, null, 2)}\n`],
    ])
  })
})

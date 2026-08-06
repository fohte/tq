import { Readable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import type { ReadableStdin } from '#input'

interface CapturedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

function captureFetch(respond: () => Response): {
  fetchStub: typeof fetch
  calls: CapturedRequest[]
} {
  const calls: CapturedRequest[] = []
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({
      method: init?.method ?? 'GET',
      url:
        input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : input,
      headers: Object.fromEntries(headers.entries()),
      body:
        typeof init?.body === 'string' && init.body.length > 0
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    })
    return Promise.resolve(respond())
  }) as typeof fetch
  return { fetchStub, calls }
}

function fakeStdin(isTTY: boolean): ReadableStdin {
  const readable = Readable.from([])
  return Object.assign(readable, { isTTY })
}

function spyStdout() {
  return vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

function spyStderr() {
  return vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
}

function query(url: string): Record<string, string> {
  return Object.fromEntries(new URL(url).searchParams)
}

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

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
    expect(calls[0]?.method).toBe('GET')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks')
    expect(query(calls[0]?.url ?? '')).toEqual({ status: 'todo' })
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
    expect(calls[0]?.method).toBe('GET')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42')
    expect(write.mock.calls).toEqual([[`${JSON.stringify(found, null, 2)}\n`]])
  })
})

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
    expect(calls[0]?.method).toBe('POST')
    expect(calls[0]?.body).toEqual({ title: 'New task' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('rejects a non-UUID --parent-id before making any fetch call', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'task',
        'create',
        'New task',
        '--parent-id',
        'not-a-uuid',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
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
    expect(calls[0]?.method).toBe('PATCH')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42')
    expect(calls[0]?.body).toEqual({ title: 'Updated title' })
  })
})

describe('task delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'delete', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.method).toBe('DELETE')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42')
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ deleted: true, id: '42' }, null, 2)}\n`],
    ])
  })
})

describe('task status', () => {
  it('sends the validated status and prints the response', async () => {
    const updated = { id: 't1', number: 1, status: 'in_progress' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'status', '42', 'in_progress'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.method).toBe('PATCH')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42/status')
    expect(calls[0]?.body).toEqual({ status: 'in_progress' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(updated, null, 2)}\n`],
    ])
  })

  it('rejects an invalid status before making any fetch call and reports the error on stderr', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'status', '42', 'bogus'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
    expect(stderr.mock.calls).toEqual([
      [
        'Error: Invalid option: expected one of "todo"|"in_progress"|"completed"\n',
      ],
    ])
  })
})

describe('task parent', () => {
  it('sends the given parentId as the request body and prints the response', async () => {
    const updated = { id: 't1', number: 1, parentId: 'p-uuid' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'parent', '42', 'p-uuid'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.method).toBe('PATCH')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42/parent')
    expect(calls[0]?.body).toEqual({ parentId: 'p-uuid' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(updated, null, 2)}\n`],
    ])
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
    expect(calls[0]?.body).toEqual({ parentId: null })
  })
})

describe('task complete', () => {
  it('sends no body and prints the whole response, including nextTask', async () => {
    const completed = {
      id: 't1',
      number: 1,
      status: 'completed',
      nextTask: null,
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(completed), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'complete', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.method).toBe('POST')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42/complete')
    expect(calls[0]?.body).toBeUndefined()
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(completed, null, 2)}\n`],
    ])
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
    expect(calls[0]?.method).toBe('GET')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/42/activity')
    expect(write.mock.calls).toEqual([[`${JSON.stringify(items, null, 2)}\n`]])
  })
})

describe('task tree', () => {
  it('sends the schema-derived flags as a query string and prints the response', async () => {
    const tree = [{ id: 't1', number: 1, title: 'Root', children: [] }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(tree), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'task', 'tree', '--sort-by', 'updated'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.method).toBe('GET')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/tree')
    expect(query(calls[0]?.url ?? '')).toEqual({ sortBy: 'updated' })
    expect(write.mock.calls).toEqual([[`${JSON.stringify(tree, null, 2)}\n`]])
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
    expect(calls[0]?.method).toBe('GET')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/search')
    expect(query(calls[0]?.url ?? '')).toEqual({ q: 'hello', limit: '5' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(results, null, 2)}\n`],
    ])
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
    expect(calls[0]?.method).toBe('POST')
    expect(new URL(calls[0]?.url ?? '').pathname).toBe('/api/tasks/from-github')
    expect(calls[0]?.body).toEqual({
      url: 'https://github.com/owner/repo/issues/1',
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })
})

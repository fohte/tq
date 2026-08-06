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

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('project list', () => {
  it('sends an empty query and prints the projects returned by the server as JSON', async () => {
    const projects = [{ id: 'p1', title: 'Website' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(projects), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(new URL(calls[0]?.url ?? '').search).toBe('')
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(projects, null, 2)}\n`],
    ])
  })

  it('sends --status as the query string', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'list', '--status', 'active'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(new URL(calls[0]?.url ?? '').searchParams.get('status')).toBe(
      'active',
    )
  })
})

describe('project get', () => {
  it('prints the project returned by the server as JSON', async () => {
    const project = { id: 'p1', title: 'Website' }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(project), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'get', 'p1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(project, null, 2)}\n`],
    ])
  })
})

describe('project create', () => {
  it('sends only the required title field when no optional flags are given', async () => {
    const created = { id: 'p1', title: 'Website' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'create', 'Website'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ title: 'Website' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('sends optional flags alongside the required title field', async () => {
    const created = { id: 'p1', title: 'Website' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'project',
        'create',
        'Website',
        '--description',
        'Company site',
        '--color',
        '#00ff00',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      title: 'Website',
      description: 'Company site',
      color: '#00ff00',
    })
  })
})

describe('project update', () => {
  it('sends only the title field when only --title is given', async () => {
    const updated = { id: 'p1', title: 'New title' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'update', 'p1', '--title', 'New title'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ title: 'New title' })
  })
})

describe('project delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'delete', 'p1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ deleted: true, id: 'p1' }, null, 2)}\n`],
    ])
  })
})

describe('project tasks', () => {
  it('prints the tasks returned by the server as JSON', async () => {
    const tasks = [{ id: 't1', title: 'Do the thing' }]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(tasks), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'project', 'tasks', 'p1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([[`${JSON.stringify(tasks, null, 2)}\n`]])
  })
})

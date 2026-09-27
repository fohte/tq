import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function commandOutcome(
  exitCode: number,
  calls: Parameters<typeof request>[0][],
  stdout: ReturnType<typeof spyStdout>,
) {
  return {
    exitCode,
    request: request(calls[0]),
    stdout: stdout.mock.calls,
  }
}

describe('saved-view list', () => {
  it('sends an empty query and prints the saved views returned by the server as JSON', async () => {
    vi.stubEnv('TQ_CONTEXT', '')
    const savedViews = [
      { id: 'view-31', name: 'Studio backlog', query: 'milestone:queued' },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(savedViews), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/saved-views',
        query: {},
        body: undefined,
      },
      stdout: [[`${JSON.stringify(savedViews, null, 2)}\n`]],
    })
  })

  it('sends --context as the query string', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'list', '--context', 'work'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/saved-views',
        query: { context: 'work' },
        body: undefined,
      },
      stdout: [[`${JSON.stringify([], null, 2)}\n`]],
    })
  })

  it('uses TQ_CONTEXT when --context is omitted', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/saved-views',
        query: { context: 'work' },
        body: undefined,
      },
      stdout: [[`${JSON.stringify([], null, 2)}\n`]],
    })
  })
})

describe('saved-view get', () => {
  it('prints the saved view returned by the server as JSON', async () => {
    const savedView = {
      id: 'view-31',
      name: 'Studio backlog',
      query: 'milestone:queued',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(savedView), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'get', 'view-31'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/saved-views/view-31',
        query: {},
        body: undefined,
      },
      stdout: [[`${JSON.stringify(savedView, null, 2)}\n`]],
    })
  })
})

describe('saved-view create', () => {
  it('sends only the required name and query fields when no optional flags are given', async () => {
    vi.stubEnv('TQ_CONTEXT', '')
    const created = {
      id: 'view-31',
      name: 'Studio backlog',
      query: 'milestone:queued',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'saved-view',
        'create',
        'Studio backlog',
        'milestone:queued',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/saved-views',
        query: {},
        body: { name: 'Studio backlog', query: 'milestone:queued' },
      },
      stdout: [[`${JSON.stringify(created, null, 2)}\n`]],
    })
  })

  it('sends optional flags alongside the required fields', async () => {
    const created = {
      id: 'view-31',
      name: 'Studio backlog',
      query: 'milestone:queued',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'saved-view',
        'create',
        'Studio backlog',
        'milestone:queued',
        '--position',
        '3',
        '--context',
        'work',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/saved-views',
        query: {},
        body: {
          name: 'Studio backlog',
          query: 'milestone:queued',
          position: 3,
          context: 'work',
        },
      },
      stdout: [[`${JSON.stringify(created, null, 2)}\n`]],
    })
  })

  it('uses TQ_CONTEXT when --context is omitted', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const created = {
      id: 'view-31',
      name: 'Studio backlog',
      query: 'milestone:queued',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'saved-view',
        'create',
        'Studio backlog',
        'milestone:queued',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/saved-views',
        query: {},
        body: {
          name: 'Studio backlog',
          query: 'milestone:queued',
          context: 'work',
        },
      },
      stdout: [[`${JSON.stringify(created, null, 2)}\n`]],
    })
  })
})

describe('saved-view update', () => {
  it('sends only the name field when only --name is given', async () => {
    const updated = {
      id: 'view-31',
      name: 'Studio portfolio',
      query: 'milestone:queued',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'saved-view',
        'update',
        'view-31',
        '--name',
        'Studio portfolio',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'PATCH',
        pathname: '/api/saved-views/view-31',
        query: {},
        body: { name: 'Studio portfolio' },
      },
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })

  it('does not apply TQ_CONTEXT when no context option is given', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const updated = {
      id: 'view-31',
      name: 'Studio portfolio',
      query: 'milestone:queued',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'saved-view',
        'update',
        'view-31',
        '--name',
        'Studio portfolio',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'PATCH',
        pathname: '/api/saved-views/view-31',
        query: {},
        body: { name: 'Studio portfolio' },
      },
      stdout: [[`${JSON.stringify(updated, null, 2)}\n`]],
    })
  })
})

describe('saved-view delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'delete', 'view-31'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'DELETE',
        pathname: '/api/saved-views/view-31',
        query: {},
        body: undefined,
      },
      stdout: [
        [`${JSON.stringify({ deleted: true, id: 'view-31' }, null, 2)}\n`],
      ],
    })
  })
})

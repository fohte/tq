import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { captureFetch, fakeStdin, spyStdout } from '#test-utils'

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('github link', () => {
  it('sends the url as the request body and prints the response', async () => {
    const linked = {
      id: 'link1',
      owner: 'fohte',
      repo: 'tq',
      number: 42,
      kind: 'issue',
      url: 'https://github.com/fohte/tq/issues/42',
      state: 'open',
      title: 'Some issue',
      lastSyncedAt: '2026-08-06T00:00:00.000Z',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(linked), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'github',
        'link',
        'task1',
        'https://github.com/fohte/tq/issues/42',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${apiUrl}/api/tasks/task1/github-link`,
        headers: { 'content-type': 'application/json' },
        body: { url: 'https://github.com/fohte/tq/issues/42' },
      },
    ])
    expect(write.mock.calls).toEqual([[`${JSON.stringify(linked, null, 2)}\n`]])
  })
})

describe('github unlink', () => {
  it('prints an unlink confirmation', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'github', 'unlink', 'task1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'DELETE',
        url: `${apiUrl}/api/tasks/task1/github-link`,
        headers: {},
        body: undefined,
      },
    ])
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ unlinked: true, taskId: 'task1' }, null, 2)}\n`],
    ])
  })
})

describe('github sync', () => {
  it('syncs a single task when taskId is given', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'github', 'sync', 'task1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${apiUrl}/api/tasks/task1/github-link/sync`,
        headers: {},
        body: undefined,
      },
    ])
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ synced: true, taskId: 'task1' }, null, 2)}\n`],
    ])
  })

  it('syncs every linked task when taskId is omitted', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'github', 'sync'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${apiUrl}/api/github/sync`,
        headers: {},
        body: undefined,
      },
    ])
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ synced: true }, null, 2)}\n`],
    ])
  })
})

describe('github resolve', () => {
  it('sends the url as the request body and prints the response', async () => {
    const resolved = { linked: false, preview: { title: 'Some issue' } }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(resolved), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'github',
        'resolve',
        'https://github.com/fohte/tq/issues/42',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${apiUrl}/api/github/resolve`,
        headers: { 'content-type': 'application/json' },
        body: { url: 'https://github.com/fohte/tq/issues/42' },
      },
    ])
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(resolved, null, 2)}\n`],
    ])
  })
})

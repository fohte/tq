import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  commandOutcome,
  fakeStdin,
  spyStdout,
} from '#commands/test-support'

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
        '42',
        'https://github.com/fohte/tq/issues/42',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'POST',
          url: `${apiUrl}/api/tasks/42/github-link`,
          headers: { 'content-type': 'application/json' },
          body: { url: 'https://github.com/fohte/tq/issues/42' },
        },
      ],
      stdout: [[`${JSON.stringify(linked, null, 2)}\n`]],
    })
  })
})

describe('github unlink', () => {
  it('prints an unlink confirmation', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'github', 'unlink', '42', 'link1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'DELETE',
          url: `${apiUrl}/api/tasks/42/github-link/link1`,
          headers: {},
          body: undefined,
        },
      ],
      stdout: [
        [
          `${JSON.stringify(
            { unlinked: true, taskId: '42', linkId: 'link1' },
            null,
            2,
          )}\n`,
        ],
      ],
    })
  })
})

describe('github sync', () => {
  it('syncs a single task when taskId is given', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'github', 'sync', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'POST',
          url: `${apiUrl}/api/tasks/42/github-link/sync`,
          headers: {},
          body: undefined,
        },
      ],
      stdout: [
        [`${JSON.stringify({ synced: true, taskId: '42' }, null, 2)}\n`],
      ],
    })
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

    expect(commandOutcome(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'POST',
          url: `${apiUrl}/api/github/sync`,
          headers: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify({ synced: true }, null, 2)}\n`]],
    })
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

    expect(commandOutcome(exitCode, calls, write.mock.calls)).toEqual({
      exitCode: 0,
      calls: [
        {
          method: 'POST',
          url: `${apiUrl}/api/github/resolve`,
          headers: { 'content-type': 'application/json' },
          body: { url: 'https://github.com/fohte/tq/issues/42' },
        },
      ],
      stdout: [[`${JSON.stringify(resolved, null, 2)}\n`]],
    })
  })
})

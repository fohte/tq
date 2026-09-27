import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

async function runGithubCli(args: string[], response: Response) {
  const { fetchStub, calls } = captureFetch(() => response)
  const write = spyStdout()
  const exitCode = await runCli(
    ['--api-url', apiUrl, ...args],
    fetchStub,
    fakeStdin(true),
  )

  return {
    exitCode,
    requests: calls.map(request),
    stdout: write.mock.calls,
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('github link', () => {
  it('sends the url as the request body and prints the response', async () => {
    const linked = {
      id: 'link1',
      owner: 'example-owner',
      repo: 'example-repo',
      number: 7,
      kind: 'issue',
      url: 'https://github.com/example-owner/example-repo/issues/7',
      state: 'open',
      title: 'A sample issue',
      lastSyncedAt: '2026-08-06T00:00:00.000Z',
    }
    expect(
      await runGithubCli(
        [
          'github',
          'link',
          '42',
          'https://github.com/example-owner/example-repo/issues/7',
        ],
        new Response(JSON.stringify(linked), { status: 201 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/tasks/42/github-link',
          query: {},
          body: {
            url: 'https://github.com/example-owner/example-repo/issues/7',
          },
        },
      ],
      stdout: [[`${JSON.stringify(linked, null, 2)}\n`]],
    })
  })
})

describe('github unlink', () => {
  it('prints an unlink confirmation', async () => {
    expect(
      await runGithubCli(
        ['github', 'unlink', '42', 'link1'],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'DELETE',
          pathname: '/api/tasks/42/github-link/link1',
          query: {},
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
    expect(
      await runGithubCli(
        ['github', 'sync', '42'],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/tasks/42/github-link/sync',
          query: {},
          body: undefined,
        },
      ],
      stdout: [
        [`${JSON.stringify({ synced: true, taskId: '42' }, null, 2)}\n`],
      ],
    })
  })

  it('syncs every linked task when taskId is omitted', async () => {
    expect(
      await runGithubCli(
        ['github', 'sync'],
        new Response(null, { status: 204 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/github/sync',
          query: {},
          body: undefined,
        },
      ],
      stdout: [[`${JSON.stringify({ synced: true }, null, 2)}\n`]],
    })
  })
})

describe('github resolve', () => {
  it('sends the url as the request body and prints the response', async () => {
    const resolved = { linked: false, preview: { title: 'A sample issue' } }

    expect(
      await runGithubCli(
        [
          'github',
          'resolve',
          'https://github.com/example-owner/example-repo/issues/7',
        ],
        new Response(JSON.stringify(resolved), { status: 200 }),
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/github/resolve',
          query: {},
          body: {
            url: 'https://github.com/example-owner/example-repo/issues/7',
          },
        },
      ],
      stdout: [[`${JSON.stringify(resolved, null, 2)}\n`]],
    })
  })
})

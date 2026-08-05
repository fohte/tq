import { Readable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import type { ReadableStdin } from '#input'

function fakeStdin(): ReadableStdin {
  const readable = Readable.from([])
  return Object.assign(readable, { isTTY: true })
}

function spyStderr() {
  return vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('runCli', () => {
  it('returns exit code 0 for --help without calling fetch', async () => {
    const fetchStub = vi.fn()

    const exitCode = await runCli(['--help'], fetchStub, fakeStdin())

    expect(exitCode).toBe(0)
    expect(fetchStub.mock.calls).toEqual([])
  })

  it('returns a non-zero exit code for an unknown subcommand', async () => {
    const fetchStub = vi.fn()

    const exitCode = await runCli(['no-such-command'], fetchStub, fakeStdin())

    expect(exitCode).not.toBe(0)
  })

  it('returns exit code 1 and reports the HTTP status when the server responds with an error', async () => {
    const fetchStub = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ error: 'Page not found' }), {
          status: 404,
        }),
      ),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', 'http://api.test', 'page', 'get', '42', 'missing'],
      fetchStub,
      fakeStdin(),
    )

    expect(exitCode).toBe(1)
    expect(stderr.mock.calls).toEqual([['Error: Page not found (HTTP 404)\n']])
  })

  it('returns exit code 1 and reports the failure when fetch rejects', async () => {
    const fetchStub = vi.fn(() =>
      Promise.reject(new Error('getaddrinfo ENOTFOUND')),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', 'http://api.test', 'page', 'list', '42'],
      fetchStub,
      fakeStdin(),
    )

    expect(exitCode).toBe(1)
    expect(stderr.mock.calls).toEqual([
      ['Error: Failed to reach http://api.test\n'],
    ])
  })
})

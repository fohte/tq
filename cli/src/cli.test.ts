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

function makeCliResult<TFetchCalls, TStderr>(
  exitCode: number,
  fetchCalls: TFetchCalls,
  stderr: TStderr,
) {
  return { exitCode, fetchCalls, stderr }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('runCli', () => {
  it('returns exit code 0 for --help without calling fetch', async () => {
    const fetchStub = vi.fn()

    const exitCode = await runCli(['--help'], fetchStub, fakeStdin())

    expect(exitCode).toBe(0)
    expect(fetchStub.mock.calls).toEqual([])
  })

  it('does not keep the renamed image command as an alias', async () => {
    const fetchStub = vi.fn()

    const exitCode = await runCli(['image'], fetchStub, fakeStdin())

    expect(exitCode).toEqual(1)
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

  it.each([
    [
      'malformed JSON',
      '{"X-Example":"secret',
      'TQ_HEADERS_JSON must contain valid JSON.',
    ],
    [
      'a value containing CR/LF',
      JSON.stringify({ 'X-Example': 'secret\r\ninjected' }),
      'TQ_HEADERS_JSON: Invalid value for HTTP header "X-Example".',
    ],
  ])(
    'rejects %s without sending a request or printing secret values',
    async (_case, value, message) => {
      vi.stubEnv('TQ_HEADERS_JSON', value)
      const fetchStub = vi.fn()
      const stderr = spyStderr()

      const exitCode = await runCli(
        ['--api-url', 'http://api.test', 'page', 'list', '42'],
        fetchStub,
        fakeStdin(),
      )

      expect(
        makeCliResult(exitCode, fetchStub.mock.calls, stderr.mock.calls),
      ).toEqual({
        exitCode: 1,
        fetchCalls: [],
        stderr: [[`Error: ${message}\n`]],
      })
    },
  )

  it.each([
    [
      'an invalid header name',
      'Bad Name: secret',
      'Error: Invalid HTTP header name "Bad Name".\n',
    ],
    [
      'a missing separator',
      'secret-value',
      'Error: Expected "Name: Value" format for --header.\n',
    ],
    [
      'a value containing CR/LF',
      'X-Example: secret\r\ninjected',
      'Error: Invalid value for HTTP header "X-Example".\n',
    ],
  ])(
    'rejects -H with %s without printing secret values',
    async (_case, value, error) => {
      const fetchStub = vi.fn()
      const stderr = spyStderr()

      const exitCode = await runCli(
        [
          '--api-url',
          'http://api.test',
          '--header',
          value,
          'page',
          'list',
          '42',
        ],
        fetchStub,
        fakeStdin(),
      )

      expect(
        makeCliResult(exitCode, fetchStub.mock.calls, stderr.mock.calls),
      ).toEqual({
        exitCode: 1,
        fetchCalls: [],
        stderr: [[error]],
      })
    },
  )
})

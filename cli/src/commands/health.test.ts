import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { captureFetch, fakeStdin, spyStdout } from '#test-utils'

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('health', () => {
  it('calls GET /health and prints the response', async () => {
    const status = { status: 'ok' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(status), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'health'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'GET',
        url: `${apiUrl}/health`,
        headers: {},
        body: undefined,
      },
    ])
    expect(write.mock.calls).toEqual([[`${JSON.stringify(status, null, 2)}\n`]])
  })
})

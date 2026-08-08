import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  spyStdout,
} from '#commands/test-support'

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

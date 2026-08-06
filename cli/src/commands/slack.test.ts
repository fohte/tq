import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { captureFetch, fakeStdin, spyStdout } from '#test-utils'

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('slack resolve', () => {
  it('sends the url as the request body and prints the response', async () => {
    const resolved = { preview: { text: 'Hello', permalink: 'https://x' } }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(resolved), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'slack',
        'resolve',
        'https://example.slack.com/archives/C1/p123',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      url: 'https://example.slack.com/archives/C1/p123',
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(resolved, null, 2)}\n`],
    ])
  })
})

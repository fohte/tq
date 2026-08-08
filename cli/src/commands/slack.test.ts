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
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${apiUrl}/api/slack/resolve`,
        headers: { 'content-type': 'application/json' },
        body: { url: 'https://example.slack.com/archives/C1/p123' },
      },
    ])
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(resolved, null, 2)}\n`],
    ])
  })
})

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

describe('label list', () => {
  it('prints the labels returned by the server as JSON', async () => {
    const labels = [{ id: 'l1', name: 'bug', color: '#ff0000' }]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(labels), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'label', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([[`${JSON.stringify(labels, null, 2)}\n`]])
  })
})

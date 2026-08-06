import { Readable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import type { ReadableStdin } from '#input'

function fakeStdin(isTTY: boolean): ReadableStdin {
  const readable = Readable.from([])
  return Object.assign(readable, { isTTY })
}

function spyStdout() {
  return vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('label list', () => {
  it('prints the labels returned by the server as JSON', async () => {
    const labels = [{ id: 'l1', name: 'bug', color: '#ff0000' }]
    const fetchStub = (() =>
      Promise.resolve(
        new Response(JSON.stringify(labels), { status: 200 }),
      )) as typeof fetch
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

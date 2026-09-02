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

describe('label update', () => {
  it('sends only the name field when only --name is given', async () => {
    const updated = { id: 'l1', name: 'defect', color: null }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'label', 'update', 'l1', '--name', 'defect'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ name: 'defect' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(updated, null, 2)}\n`],
    ])
  })

  it('sends only the context field when only --context is given', async () => {
    const updated = { id: 'l1', name: 'bug', color: null, context: 'work' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'label', 'update', 'l1', '--context', 'work'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ context: 'work' })
  })
})

describe('label delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'label', 'delete', 'l1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ deleted: true, id: 'l1' }, null, 2)}\n`],
    ])
  })
})

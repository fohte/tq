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

describe('saved-view list', () => {
  it('sends an empty query and prints the saved views returned by the server as JSON', async () => {
    const savedViews = [{ id: 'v1', name: 'Now', query: 'commitment:active' }]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(savedViews), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(new URL(calls[0]?.url ?? '').search).toBe('')
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(savedViews, null, 2)}\n`],
    ])
  })

  it('sends --context as the query string', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'list', '--context', 'work'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(new URL(calls[0]?.url ?? '').searchParams.get('context')).toBe(
      'work',
    )
  })
})

describe('saved-view get', () => {
  it('prints the saved view returned by the server as JSON', async () => {
    const savedView = { id: 'v1', name: 'Now', query: 'commitment:active' }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(savedView), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'get', 'v1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(savedView, null, 2)}\n`],
    ])
  })
})

describe('saved-view create', () => {
  it('sends only the required name and query fields when no optional flags are given', async () => {
    const created = { id: 'v1', name: 'Now', query: 'commitment:active' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'create', 'Now', 'commitment:active'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      name: 'Now',
      query: 'commitment:active',
    })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('sends optional flags alongside the required fields', async () => {
    const created = { id: 'v1', name: 'Now', query: 'commitment:active' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'saved-view',
        'create',
        'Now',
        'commitment:active',
        '--position',
        '3',
        '--context',
        'work',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      name: 'Now',
      query: 'commitment:active',
      position: 3,
      context: 'work',
    })
  })
})

describe('saved-view update', () => {
  it('sends only the name field when only --name is given', async () => {
    const updated = { id: 'v1', name: 'Later', query: 'commitment:active' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'update', 'v1', '--name', 'Later'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ name: 'Later' })
  })
})

describe('saved-view delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'saved-view', 'delete', 'v1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ deleted: true, id: 'v1' }, null, 2)}\n`],
    ])
  })
})

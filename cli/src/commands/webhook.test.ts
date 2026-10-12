import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('webhook create', () => {
  it('uses TQ_WEBHOOK_SECRET and does not print the secret', async () => {
    vi.stubEnv('TQ_WEBHOOK_SECRET', 'test-webhook-secret')
    const created = {
      id: '00000000-0000-4000-8000-000000000001',
      url: 'https://hooks.example.invalid/tq',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'webhook', 'create', created.url],
      fetchStub,
      fakeStdin(true),
    )

    const createSnapshot = () => ({
      exitCode,
      request: request(calls[0]),
      output: write.mock.calls,
    })

    expect(createSnapshot()).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/webhooks',
        query: {},
        body: { url: created.url, secret: 'test-webhook-secret' },
      },
      output: [[`${JSON.stringify(created, null, 2)}\n`]],
    })
  })

  it('prefers the --secret option over TQ_WEBHOOK_SECRET', async () => {
    vi.stubEnv('TQ_WEBHOOK_SECRET', 'environment-secret')
    const created = {
      id: '00000000-0000-4000-8000-000000000001',
      url: 'https://hooks.example.invalid/tq',
      createdAt: '2026-01-01T00:00:00.000Z',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'webhook',
        'create',
        created.url,
        '--secret',
        'command-line-secret',
      ],
      fetchStub,
      fakeStdin(true),
    )

    const createSnapshot = () => ({
      exitCode,
      request: request(calls[0]),
      output: write.mock.calls,
    })

    expect(createSnapshot()).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/webhooks',
        query: {},
        body: { url: created.url, secret: 'command-line-secret' },
      },
      output: [[`${JSON.stringify(created, null, 2)}\n`]],
    })
  })
})

describe('webhook list', () => {
  it('lists the subscriptions returned by the API', async () => {
    const subscriptions = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        url: 'https://hooks.example.invalid/tq',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(subscriptions), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'webhook', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    const listSnapshot = () => ({
      exitCode,
      request: request(calls[0]),
      output: write.mock.calls,
    })

    expect(listSnapshot()).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/webhooks',
        query: {},
        body: undefined,
      },
      output: [[`${JSON.stringify(subscriptions, null, 2)}\n`]],
    })
  })
})

describe('webhook delete', () => {
  it('deletes the subscription identified by its UUID', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'webhook', 'delete', id],
      fetchStub,
      fakeStdin(true),
    )

    const deleteSnapshot = () => ({
      exitCode,
      request: request(calls[0]),
      output: write.mock.calls,
    })

    expect(deleteSnapshot()).toEqual({
      exitCode: 0,
      request: {
        method: 'DELETE',
        pathname: `/api/webhooks/${id}`,
        query: {},
        body: undefined,
      },
      output: [[`${JSON.stringify({ deleted: true, id }, null, 2)}\n`]],
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('link', () => {
  it('resolves the current session and links it to the task', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'sess-1')
    const session = { id: 'agent-session-1', sessionId: 'sess-1' }
    const { fetchStub, calls } = captureFetch(() => {
      // captureFetch records the call before invoking this callback, so the
      // first call is already reflected in calls.length by the time this runs.
      if (calls.length === 1) {
        return new Response(JSON.stringify(session), { status: 200 })
      }
      return new Response(JSON.stringify(session), { status: 201 })
    })

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/agent-sessions/by-session/claude_code/sess-1',
      query: {},
      body: undefined,
    })
    expect(request(calls[1])).toEqual({
      method: 'POST',
      pathname: '/api/tasks/42/agent-sessions',
      query: {},
      body: { agentSessionId: 'agent-session-1' },
    })
  })

  it('fails before making any fetch call when TQ_SESSION_ID is not set', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
  })

  it('fails when the current session is not known to tq', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'sess-1')
    const { fetchStub, calls } = captureFetch(
      () =>
        new Response(JSON.stringify({ error: 'Agent session not found' }), {
          status: 404,
        }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(1)
  })
})

describe('unlink', () => {
  it('resolves the current session and unlinks it from the task', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'sess-1')
    const session = { id: 'agent-session-1', sessionId: 'sess-1' }
    const { fetchStub, calls } = captureFetch(() => {
      // captureFetch records the call before invoking this callback, so the
      // first call is already reflected in calls.length by the time this runs.
      if (calls.length === 1) {
        return new Response(JSON.stringify(session), { status: 200 })
      }
      return new Response(null, { status: 204 })
    })

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'unlink', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/agent-sessions/by-session/claude_code/sess-1',
      query: {},
      body: undefined,
    })
    expect(request(calls[1])).toEqual({
      method: 'DELETE',
      pathname: '/api/tasks/42/agent-sessions/agent-session-1',
      query: {},
      body: undefined,
    })
  })

  it('fails before making any fetch call when TQ_SESSION_ID is not set', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'unlink', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
  })
})

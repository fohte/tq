import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

function spyStderr() {
  return vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('link', () => {
  it('resolves the current session and links it to the task', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'sess-1')
    const session = { id: 'agent-session-1', sessionId: 'sess-1' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(session), { status: 200 }),
    )
    const write = spyStdout()

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
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(session, null, 2)}\n`],
    ])
  })

  it('fails before making any fetch call when TQ_SESSION_ID is not set', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
    expect(stderr.mock.calls).toEqual([
      [
        'Error: TQ_SESSION_ID is not set. Run this from within a Claude Code session with the SessionStart hook configured to run `tq hook SessionStart`.\n',
      ],
    ])
  })

  it('fails when the current session is not known to tq', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'sess-1')
    const { fetchStub, calls } = captureFetch(
      () =>
        new Response(JSON.stringify({ error: 'Agent session not found' }), {
          status: 404,
        }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(1)
    expect(stderr.mock.calls).toEqual([
      ['Error: Agent session not found (HTTP 404)\n'],
    ])
  })
})

describe('unlink', () => {
  it('resolves the current session and unlinks it from the task', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'sess-1')
    const session = { id: 'agent-session-1', sessionId: 'sess-1' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(session), { status: 200 }),
    )
    const write = spyStdout()

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
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ unlinked: true, taskId: '42' }, null, 2)}\n`],
    ])
  })

  it('fails before making any fetch call when TQ_SESSION_ID is not set', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'unlink', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(0)
    expect(stderr.mock.calls).toEqual([
      [
        'Error: TQ_SESSION_ID is not set. Run this from within a Claude Code session with the SessionStart hook configured to run `tq hook SessionStart`.\n',
      ],
    ])
  })
})

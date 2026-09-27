import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

function summarizeCliResult(
  exitCode: number,
  stderr: ReturnType<typeof spyStderr>,
) {
  return { exitCode, stderr: stderr.mock.calls }
}

function summarizeLinkOutcome(
  exitCode: number,
  calls: ReturnType<typeof captureFetch>['calls'],
  stderr: ReturnType<typeof spyStderr>,
) {
  return { exitCode, calls, stderr: stderr.mock.calls }
}

function summarizeLinkRequest(
  exitCode: number,
  requestValue: ReturnType<typeof request>,
) {
  return { exitCode, request: requestValue }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

beforeEach(() => {
  vi.stubEnv('TQ_SESSION_ID', '')
  vi.stubEnv('CODEX_SESSION_ID', '')
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

  it('prefers the Codex session when both agent session ids are set', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'claude-sess-1')
    vi.stubEnv('CODEX_SESSION_ID', 'codex-sess-1')
    const session = { id: 'agent-session-1', sessionId: 'codex-sess-1' }
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
      pathname: '/api/agent-sessions/by-session/codex/codex-sess-1',
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

  it('rejects dot path segments in the current session id', async () => {
    vi.stubEnv('TQ_SESSION_ID', '..')
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeLinkOutcome(exitCode, calls, stderr)).toEqual({
      exitCode: 1,
      calls: [],
      stderr: [['Error: sessionId: Session ID must be a valid path segment\n']],
    })
  })

  it('encodes path separators in the current session id', async () => {
    vi.stubEnv('TQ_SESSION_ID', 'segment/with separator')
    const session = {
      id: 'agent-session-1',
      sessionId: 'segment/with separator',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(session), { status: 200 }),
    )
    const exitCode = await runCli(
      ['--api-url', apiUrl, 'link', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeLinkRequest(exitCode, request(calls[0]))).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname:
          '/api/agent-sessions/by-session/claude_code/segment%2Fwith%20separator',
        query: {},
        body: undefined,
      },
    })
  })

  it('fails before making any fetch call when no agent session id is set', async () => {
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
        'Error: No agent session ID is set. Expected CODEX_SESSION_ID for Codex or TQ_SESSION_ID for Claude Code (set by the SessionStart hook configured to run `tq hook SessionStart`).\n',
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

  it('reports a missing API URL before a missing agent session ID', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify({}), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(['link', '42'], fetchStub, fakeStdin(true))

    expect(summarizeCliResult(exitCode, stderr)).toEqual({
      exitCode: 1,
      stderr: [
        [
          'Error: API URL is not set. Pass --api-url or set the TQ_API_URL environment variable.\n',
        ],
      ],
    })
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

  it('resolves a Codex session and unlinks it from the task', async () => {
    vi.stubEnv('CODEX_SESSION_ID', 'codex-sess-1')
    const session = { id: 'agent-session-1', sessionId: 'codex-sess-1' }
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
      pathname: '/api/agent-sessions/by-session/codex/codex-sess-1',
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

  it('fails before making any fetch call when no agent session id is set', async () => {
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
        'Error: No agent session ID is set. Expected CODEX_SESSION_ID for Codex or TQ_SESSION_ID for Claude Code (set by the SessionStart hook configured to run `tq hook SessionStart`).\n',
      ],
    ])
  })
})

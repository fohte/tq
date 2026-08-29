import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStderr,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
})

const session1 = {
  id: 'agent-session-1',
  provider: 'claude_code',
  sessionId: 'sess-1',
  context: 'work',
  cwd: '/home/fohte/project',
  label: 'Session 1',
  lastMessage: 'Did something',
  customLabel: null,
  startedAt: '2030-01-01T00:00:00.000Z',
  lastActiveAt: '2030-01-01T00:00:00.000Z',
  endedAt: null,
}

const session2 = {
  id: 'agent-session-2',
  provider: 'claude_code',
  sessionId: 'sess-2',
  context: 'personal',
  cwd: '/home/fohte/other',
  label: 'Session 2',
  lastMessage: 'Did something else',
  customLabel: null,
  startedAt: '2030-01-02T00:00:00.000Z',
  lastActiveAt: '2030-01-02T00:00:00.000Z',
  endedAt: null,
}

describe('session list', () => {
  it('lists sessions with the tasks each is linked to, defaulting unlinked sessions to an empty array', async () => {
    const sessions = [session1, session2]
    const byTask = [
      {
        taskId: 'task-1',
        taskNumber: 1,
        taskTitle: 'First task',
        ...session1,
      },
      {
        taskId: 'task-2',
        taskNumber: 2,
        taskTitle: 'Second task',
        ...session1,
      },
    ]
    const responses = [
      new Response(JSON.stringify(sessions), { status: 200 }),
      new Response(JSON.stringify(byTask), { status: 200 }),
    ]
    const { fetchStub, calls } = captureFetch(
      () => responses.shift() ?? new Response(null, { status: 500 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'session', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(request(calls[0])).toEqual({
      method: 'GET',
      pathname: '/api/agent-sessions',
      query: {},
      body: undefined,
    })
    expect(request(calls[1])).toEqual({
      method: 'GET',
      pathname: '/api/agent-sessions/by-task',
      query: {},
      body: undefined,
    })
    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          [
            {
              ...session1,
              tasks: [
                { id: 'task-1', number: 1, title: 'First task' },
                { id: 'task-2', number: 2, title: 'Second task' },
              ],
            },
            { ...session2, tasks: [] },
          ],
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('reports the API error when the sessions request fails', async () => {
    const { fetchStub, calls } = captureFetch(
      () =>
        new Response(JSON.stringify({ error: 'Internal error' }), {
          status: 500,
        }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'session', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls.length).toBe(1)
    expect(stderr.mock.calls).toEqual([['Error: Internal error (HTTP 500)\n']])
  })
})

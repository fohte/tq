import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  spyStderr,
  spyStdout,
} from '#commands/test-support'

function eventsResultSnapshot<TRequests, TStdout, TStderr>(
  exitCode: number,
  requests: TRequests,
  stdout: TStdout,
  stderr: TStderr,
) {
  return { exitCode, requests, stdout, stderr }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('events', () => {
  const taskChange =
    '{"resource":"task","id":"task-a","origin":null,"taskIds":["task-a"]}'
  const labelChange =
    '{"resource":"label","id":"label-a","origin":null,"taskIds":[]}'

  it.each([
    {
      name: 'fragmented chunks and heartbeats',
      input:
        `event: change\ndata: ${taskChange}\n\n` +
        'event: heartbeat\ndata: \n\n' +
        `event: change\ndata: ${labelChange}\n\n`,
      changes: [taskChange, labelChange],
    },
    {
      name: 'CRLF line endings',
      input: `event: change\r\n: keepalive\r\ndata: ${taskChange}\r\n\r\n`,
      changes: [taskChange],
    },
    {
      name: 'multiple data fields',
      input:
        'event: change\ndata: {"resource":"task",\ndata: "id":"task-a",\ndata: "origin":null,\ndata: "taskIds":["task-a"]}\n\n',
      changes: [taskChange],
    },
    {
      name: 'comment lines',
      input: `: server comment\nevent: change\ndata: ${taskChange}\n\n`,
      changes: [taskChange],
    },
  ])(
    'prints a connected marker and change events for $name before failing when the stream closes',
    async ({ input, changes }) => {
      vi.stubEnv('TQ_HEADERS_JSON', '{"X-Access-Token":"fictional-secret"}')
      const encoder = new TextEncoder()
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const bytes = encoder.encode(input)
          controller.enqueue(bytes.slice(0, 37))
          controller.enqueue(bytes.slice(37))
          controller.close()
        },
      })
      const { fetchStub, calls } = captureFetch(
        () =>
          new Response(stream, {
            status: 200,
            headers: { 'content-type': 'text/event-stream' },
          }),
      )
      const stdout = spyStdout()
      const stderr = spyStderr()

      const exitCode = await runCli(
        ['--api-url', apiUrl, 'events'],
        fetchStub,
        fakeStdin(true),
      )
      const output = ['{"type":"connected"}', ...changes].map((line) => [
        `${line}\n`,
      ])

      expect(
        eventsResultSnapshot(
          exitCode,
          calls,
          stdout.mock.calls,
          stderr.mock.calls,
        ),
      ).toEqual({
        exitCode: 1,
        requests: [
          {
            method: 'GET',
            url: `${apiUrl}/api/events`,
            headers: {
              accept: 'text/event-stream',
              'x-access-token': 'fictional-secret',
            },
            body: undefined,
          },
        ],
        stdout: output,
        stderr: [['Error: Event stream closed.\n']],
      })
    },
  )

  it('waits for stdout to drain before reading another event', async () => {
    const encoder = new TextEncoder()
    const { fetchStub } = captureFetch(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(`event: change\ndata: ${taskChange}\n\n`),
              )
              controller.enqueue(
                encoder.encode(`event: change\ndata: ${labelChange}\n\n`),
              )
              controller.close()
            },
          }),
          { status: 200 },
        ),
    )
    const writes: string[] = []
    spyStdout().mockImplementation((chunk) => {
      const line = String(chunk)
      writes.push(line)
      if (line === `${taskChange}\n`) {
        setImmediate(() => {
          writes.push('drain')
          process.stdout.emit('drain')
        })
        return false
      }
      return true
    })
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'events'],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      eventsResultSnapshot(exitCode, undefined, writes, stderr.mock.calls),
    ).toEqual({
      exitCode: 1,
      requests: undefined,
      stdout: [
        '{"type":"connected"}\n',
        `${taskChange}\n`,
        'drain',
        `${labelChange}\n`,
      ],
      stderr: [['Error: Event stream closed.\n']],
    })
  })

  it('reports an error when the request cannot connect', async () => {
    const fetchStub = vi.fn(() => Promise.reject(new Error('connection reset')))
    const stdout = spyStdout()
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'events'],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      eventsResultSnapshot(
        exitCode,
        undefined,
        stdout.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 1,
      requests: undefined,
      stdout: [],
      stderr: [['Error: Failed to reach http://api.test\n']],
    })
  })

  it('exits without a connected marker when the server rejects the request', async () => {
    const { fetchStub, calls } = captureFetch(
      () =>
        new Response(JSON.stringify({ error: 'Access denied' }), {
          status: 401,
        }),
    )
    const stdout = spyStdout()
    const stderr = spyStderr()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'events'],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      eventsResultSnapshot(
        exitCode,
        calls,
        stdout.mock.calls,
        stderr.mock.calls,
      ),
    ).toEqual({
      exitCode: 1,
      requests: [
        {
          method: 'GET',
          url: `${apiUrl}/api/events`,
          headers: { accept: 'text/event-stream' },
          body: undefined,
        },
      ],
      stdout: [],
      stderr: [['Error: Access denied (HTTP 401)\n']],
    })
  })

  it('exits when no event or heartbeat arrives for 90 seconds', async () => {
    vi.useFakeTimers()
    let resolveConnected: () => void = () => undefined
    let requestSignal: AbortSignal | null | undefined
    const connected = new Promise<void>((resolve) => {
      resolveConnected = resolve
    })
    const fetchStub = vi.fn(
      (_input: string | URL | Request, init?: RequestInit) => {
        requestSignal = init?.signal
        return Promise.resolve(
          new Response(new ReadableStream<Uint8Array>(), { status: 200 }),
        )
      },
    ) as typeof fetch
    const stdout = spyStdout().mockImplementation(() => {
      resolveConnected()
      return true
    })
    const stderr = spyStderr()

    const result = runCli(
      ['--api-url', apiUrl, 'events'],
      fetchStub,
      fakeStdin(true),
    )
    await connected
    await Promise.resolve()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(90_000)
    const exitCode = await result

    const snapshot = () => ({
      exitCode,
      requestSignalAborted: requestSignal?.aborted,
      stdout: stdout.mock.calls,
      stderr: stderr.mock.calls,
    })
    expect(snapshot()).toEqual({
      exitCode: 1,
      requestSignalAborted: true,
      stdout: [['{"type":"connected"}\n']],
      stderr: [['Error: Event stream idle for 90 seconds.\n']],
    })
  })
})

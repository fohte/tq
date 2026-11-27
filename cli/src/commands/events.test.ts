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
})

describe('events', () => {
  it('prints a connected marker and change events before failing when the stream closes', async () => {
    vi.stubEnv('TQ_HEADERS_JSON', '{"X-Access-Token":"fictional-secret"}')
    const encoder = new TextEncoder()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const input =
          'event: change\ndata: {"resource":"task","id":"task-a","origin":null,"taskIds":["task-a"]}\n\n' +
          'event: heartbeat\ndata: \n\n' +
          'event: change\ndata: {"resource":"label","id":"label-a","origin":null,"taskIds":[]}\n\n'
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
      stdout: [
        ['{"type":"connected"}\n'],
        [
          '{"resource":"task","id":"task-a","origin":null,"taskIds":["task-a"]}\n',
        ],
        ['{"resource":"label","id":"label-a","origin":null,"taskIds":[]}\n'],
      ],
      stderr: [['Error: Event stream closed.\n']],
    })
  })
})

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

const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111'

function commandOutcome(
  exitCode: number,
  requests: ReturnType<typeof request>[],
  stderr: unknown[][],
  stdout: unknown[][],
) {
  return { exitCode, requests, stderr, stdout }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('recurring template occurrence create', () => {
  it('posts the template ID and occurrence date', async () => {
    const responseBody = { id: 'created-task', occurrenceDate: '2031-04-11' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(responseBody), { status: 201 }),
    )
    const stderr = spyStderr()
    const stdout = spyStdout()
    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'recurring-template',
        'occurrence',
        'create',
        TEMPLATE_ID,
        '2031-04-11',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(
      commandOutcome(
        exitCode,
        calls.map(request),
        stderr.mock.calls,
        stdout.mock.calls,
      ),
    ).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: `/api/recurring-task-templates/${TEMPLATE_ID}/occurrences`,
          query: {},
          body: { occurrenceDate: '2031-04-11' },
        },
      ],
      stderr: [],
      stdout: [[`${JSON.stringify(responseBody, null, 2)}\n`]],
    })
  })
})

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

function waitCommandSnapshot<TRequests, TOutput>(
  exitCodes: number[],
  requests: TRequests,
  output: TOutput,
) {
  return { exitCodes, requests, output }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('wait commands', () => {
  it('maps add, update, resolve, and remove to their API routes', async () => {
    const responses = [
      { id: 'wait-id', body: 'Initial request' },
      { id: 'wait-id', body: 'Updated request' },
      { id: 'wait-id', resolvedAt: '2036-04-05T00:00:00.000Z' },
      null,
    ]
    let responseIndex = 0
    const { fetchStub, calls } = captureFetch(() => {
      const response = responses[responseIndex++]
      return response == null
        ? new Response(null, { status: 204 })
        : new Response(JSON.stringify(response), {
            status: responseIndex === 1 ? 201 : 200,
          })
    })
    const write = spyStdout()
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-540)
    const commands = [
      [
        '--api-url',
        apiUrl,
        'wait',
        'add',
        '42',
        '--body',
        'Initial request',
        '--follow-up-date',
        '2036-04-05',
      ],
      [
        '--api-url',
        apiUrl,
        'wait',
        'update',
        '42',
        '550e8400-e29b-41d4-a716-446655440000',
        '--body',
        'Updated request',
      ],
      [
        '--api-url',
        apiUrl,
        'wait',
        'resolve',
        '42',
        '550e8400-e29b-41d4-a716-446655440000',
      ],
      [
        '--api-url',
        apiUrl,
        'wait',
        'remove',
        '42',
        '550e8400-e29b-41d4-a716-446655440000',
      ],
    ]
    const exitCodes: number[] = []
    for (const command of commands) {
      exitCodes.push(await runCli(command, fetchStub, fakeStdin(true)))
    }

    expect(
      waitCommandSnapshot(exitCodes, calls.map(request), write.mock.calls),
    ).toEqual({
      exitCodes: [0, 0, 0, 0],
      requests: [
        {
          method: 'POST',
          pathname: '/api/tasks/42/waits',
          query: {},
          body: {
            body: 'Initial request',
            followUpDate: '2036-04-05',
            tzOffset: -540,
          },
        },
        {
          method: 'PATCH',
          pathname: '/api/tasks/42/waits/550e8400-e29b-41d4-a716-446655440000',
          query: {},
          body: { body: 'Updated request' },
        },
        {
          method: 'POST',
          pathname:
            '/api/tasks/42/waits/550e8400-e29b-41d4-a716-446655440000/resolve',
          query: {},
          body: undefined,
        },
        {
          method: 'DELETE',
          pathname: '/api/tasks/42/waits/550e8400-e29b-41d4-a716-446655440000',
          query: {},
          body: undefined,
        },
      ],
      output: [
        [`${JSON.stringify(responses[0], null, 2)}\n`],
        [`${JSON.stringify(responses[1], null, 2)}\n`],
        [`${JSON.stringify(responses[2], null, 2)}\n`],
      ],
    })
  })
})

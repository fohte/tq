import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  request,
  spyStdout,
} from '#commands/test-support'

afterEach(() => vi.restoreAllMocks())

function projectFieldCommandSnapshot<TRequests, TOutput>(
  exitCodes: number[],
  requests: TRequests,
  output: TOutput,
) {
  return { exitCodes, requests, output }
}

describe('project field commands', () => {
  it('maps field and option commands to their API routes', async () => {
    const responses = [
      [],
      {
        id: 'field-id',
        projectId: 'example-project',
        name: 'Orbit Class',
        type: 'single_select',
        options: [
          { id: 'option-a', name: 'Amber' },
          { id: 'option-b', name: 'Cobalt' },
        ],
      },
      { id: 'field-id', projectId: 'example-project', name: 'Orbit Group' },
      null,
      { id: 'option-id', name: 'Amber' },
      { id: 'option-id', name: 'Cobalt' },
      null,
    ]
    const statuses = [200, 201, 200, 204, 201, 200, 204]
    let responseIndex = 0
    const { fetchStub, calls } = captureFetch(() => {
      const response = responses[responseIndex]
      const status = statuses[responseIndex] ?? 200
      responseIndex += 1
      return response == null
        ? new Response(null, { status })
        : new Response(JSON.stringify(response), { status })
    })
    const write = spyStdout()
    const commands = [
      ['project', 'field', 'list', 'example-project'],
      [
        'project',
        'field',
        'create',
        'example-project',
        'Orbit Class',
        '--options',
        'Amber,Cobalt',
      ],
      [
        'project',
        'field',
        'update',
        'example-project',
        '550e8400-e29b-41d4-a716-446655440000',
        'Orbit Group',
      ],
      [
        'project',
        'field',
        'delete',
        'example-project',
        '550e8400-e29b-41d4-a716-446655440000',
      ],
      [
        'project',
        'field',
        'option',
        'create',
        'example-project',
        '550e8400-e29b-41d4-a716-446655440000',
        'Amber',
      ],
      [
        'project',
        'field',
        'option',
        'update',
        'example-project',
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
        'Cobalt',
      ],
      [
        'project',
        'field',
        'option',
        'delete',
        'example-project',
        '550e8400-e29b-41d4-a716-446655440000',
        '550e8400-e29b-41d4-a716-446655440001',
      ],
    ]
    const exitCodes: number[] = []
    for (const command of commands) {
      exitCodes.push(
        await runCli(
          ['--api-url', apiUrl, ...command],
          fetchStub,
          fakeStdin(true),
        ),
      )
    }

    expect(
      projectFieldCommandSnapshot(
        exitCodes,
        calls.map(request),
        write.mock.calls,
      ),
    ).toEqual({
      exitCodes: [0, 0, 0, 0, 0, 0, 0],
      requests: [
        {
          method: 'GET',
          pathname: '/api/projects/example-project/fields',
          query: {},
          body: undefined,
        },
        {
          method: 'POST',
          pathname: '/api/projects/example-project/fields',
          query: {},
          body: { name: 'Orbit Class', options: ['Amber', 'Cobalt'] },
        },
        {
          method: 'PATCH',
          pathname:
            '/api/projects/example-project/fields/550e8400-e29b-41d4-a716-446655440000',
          query: {},
          body: { name: 'Orbit Group' },
        },
        {
          method: 'DELETE',
          pathname:
            '/api/projects/example-project/fields/550e8400-e29b-41d4-a716-446655440000',
          query: {},
          body: undefined,
        },
        {
          method: 'POST',
          pathname:
            '/api/projects/example-project/fields/550e8400-e29b-41d4-a716-446655440000/options',
          query: {},
          body: { name: 'Amber' },
        },
        {
          method: 'PATCH',
          pathname:
            '/api/projects/example-project/fields/550e8400-e29b-41d4-a716-446655440000/options/550e8400-e29b-41d4-a716-446655440001',
          query: {},
          body: { name: 'Cobalt' },
        },
        {
          method: 'DELETE',
          pathname:
            '/api/projects/example-project/fields/550e8400-e29b-41d4-a716-446655440000/options/550e8400-e29b-41d4-a716-446655440001',
          query: {},
          body: undefined,
        },
      ],
      output: [
        ['[]\n'],
        [
          `${JSON.stringify(
            {
              id: 'field-id',
              projectId: 'example-project',
              name: 'Orbit Class',
              type: 'single_select',
              options: [
                { id: 'option-a', name: 'Amber' },
                { id: 'option-b', name: 'Cobalt' },
              ],
            },
            null,
            2,
          )}\n`,
        ],
        [
          `${JSON.stringify(
            {
              id: 'field-id',
              projectId: 'example-project',
              name: 'Orbit Group',
            },
            null,
            2,
          )}\n`,
        ],
        [`${JSON.stringify({ id: 'option-id', name: 'Amber' }, null, 2)}\n`],
        [`${JSON.stringify({ id: 'option-id', name: 'Cobalt' }, null, 2)}\n`],
      ],
    })
  })
})

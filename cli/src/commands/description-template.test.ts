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

function commandOutcome(
  exitCode: number,
  calls: Parameters<typeof request>[0][],
  stdout: ReturnType<typeof spyStdout>,
) {
  return {
    exitCode,
    request: request(calls[0]),
    stdout: stdout.mock.calls,
  }
}

describe('description-template list', () => {
  it('prints the description templates returned by the server as JSON', async () => {
    const templates = [
      {
        id: 'template-17',
        name: 'Weekly plan',
        whenToUse: 'Use for planning work for a week.',
        body: '## Goal\n\n## Steps',
        guide: 'Describe the goal and list the steps.',
        isDefault: true,
        createdAt: '2026-01-02T03:04:05.000Z',
        updatedAt: '2026-01-02T03:04:05.000Z',
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(templates), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'description-template', 'list'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/description-templates',
        query: {},
        body: undefined,
      },
      stdout: [[`${JSON.stringify(templates, null, 2)}\n`]],
    })
  })
})

describe('description-template get', () => {
  it('gets a template by name and prints it as JSON', async () => {
    const template = {
      id: 'template-17',
      name: 'Weekly plan',
      whenToUse: 'Use for planning work for a week.',
      body: '## Goal\n\n## Steps',
      guide: 'Describe the goal and list the steps.',
      isDefault: true,
      createdAt: '2026-01-02T03:04:05.000Z',
      updatedAt: '2026-01-02T03:04:05.000Z',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(template), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'description-template', 'get', 'Weekly plan'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/description-templates/Weekly%20plan',
        query: {},
        body: undefined,
      },
      stdout: [[`${JSON.stringify(template, null, 2)}\n`]],
    })
  })
})

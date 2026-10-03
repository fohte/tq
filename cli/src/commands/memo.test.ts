import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  calls: ReturnType<typeof captureFetch>['calls'],
  stdout: ReturnType<typeof spyStdout>,
) {
  return {
    exitCode,
    request: request(calls[0]),
    stdout: stdout.mock.calls,
  }
}

describe('memo get', () => {
  it('gets the memo for the selected context', async () => {
    const memo = {
      context: 'work',
      content: 'An idea to revisit',
      revision: 3,
      updatedAt: '2025-01-02T03:04:05.000Z',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(memo), { status: 200 }),
    )
    const stdout = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'memo', 'get', '--context', 'work'],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/memos/work',
        query: {},
        body: undefined,
      },
      stdout: [[`${JSON.stringify(memo, null, 2)}\n`]],
    })
  })
})

describe('memo update', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('sends the file content with the expected revision', async () => {
    const memo = {
      context: 'personal',
      content: 'Keep for later',
      revision: 4,
      updatedAt: '2025-01-02T03:04:05.000Z',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(memo), { status: 200 }),
    )
    const stdout = spyStdout()

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-memo-'))
    const filePath = join(tmpDir, 'content.md')
    await writeFile(filePath, memo.content, 'utf8')

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'memo',
        'update',
        '--context',
        'personal',
        '--revision',
        '3',
        '--file',
        filePath,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(commandOutcome(exitCode, calls, stdout)).toEqual({
      exitCode: 0,
      request: {
        method: 'PUT',
        pathname: '/api/memos/personal',
        query: {},
        body: { content: 'Keep for later', revision: 3 },
      },
      stdout: [[`${JSON.stringify(memo, null, 2)}\n`]],
    })
  })
})

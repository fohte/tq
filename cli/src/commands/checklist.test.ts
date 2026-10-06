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
})

function summarizeCliRun(
  exitCode: number,
  calls: ReturnType<typeof captureFetch>['calls'],
  output: ReturnType<typeof spyStdout>,
) {
  return {
    exitCode,
    request: request(calls[0]),
    output: output.mock.calls,
  }
}

describe('checklist list', () => {
  it('lists checklists using a task number and prints the nested tree', async () => {
    const response = [
      {
        id: 'checklist-id',
        taskId: 'task-id',
        name: 'Preparation',
        sortOrder: 0,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        items: [],
      },
    ]
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'checklist', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      request: {
        method: 'GET',
        pathname: '/api/tasks/42/checklists',
        query: {},
        body: undefined,
      },
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })
})

describe('checklist item add', () => {
  let directory: string | undefined

  afterEach(async () => {
    if (directory != null) {
      await rm(directory, { recursive: true })
      directory = undefined
    }
  })

  it('reads Markdown detail from --note-file and maps --parent to the API input', async () => {
    directory = await mkdtemp(join(tmpdir(), 'tq-checklist-'))
    const notePath = join(directory, 'detail.md')
    await writeFile(notePath, 'A short detail', 'utf8')
    const response = { id: 'item-id', content: 'Prepare materials' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'checklist',
        'item',
        'add',
        'checklist-id',
        'Prepare materials',
        '--parent',
        'parent-id',
        '--note-file',
        notePath,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      request: {
        method: 'POST',
        pathname: '/api/checklists/checklist-id/items',
        query: {},
        body: {
          content: 'Prepare materials',
          parentItemId: 'parent-id',
          note: 'A short detail',
        },
      },
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })
})

describe('checklist item move', () => {
  it('maps --root to an explicit null parent', async () => {
    const response = { id: 'item-id', parentItemId: null }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'checklist', 'item', 'move', 'item-id', '--root'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      request: {
        method: 'PATCH',
        pathname: '/api/checklist-items/item-id/move',
        query: {},
        body: { parentItemId: null },
      },
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })
})

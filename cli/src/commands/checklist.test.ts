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
  spyStderr,
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
    requests: calls.map(request),
    output: output.mock.calls,
  }
}

function summarizeCliFailure(
  exitCode: number,
  calls: ReturnType<typeof captureFetch>['calls'],
  stderr: ReturnType<typeof spyStderr>,
) {
  return {
    exitCode,
    requests: calls.map(request),
    stderr: stderr.mock.calls.map(([message]) => String(message)),
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
      requests: [
        {
          method: 'GET',
          pathname: '/api/tasks/42/checklists',
          query: {},
          body: undefined,
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })
})

describe('checklist update', () => {
  it('maps --unnamed to an explicit null name', async () => {
    const response = { id: 'checklist-id', name: null }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'checklist', 'update', 'checklist-id', '--unnamed'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/checklists/checklist-id',
          query: {},
          body: { name: null },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })

  it('rejects --unnamed together with --name without sending a request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'checklist',
        'update',
        'checklist-id',
        '--name',
        'Release',
        '--unnamed',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliFailure(exitCode, calls, stderr)).toEqual({
      exitCode: 1,
      requests: [],
      stderr: ['Error: Use either --name or --unnamed, not both.\n'],
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
      requests: [
        {
          method: 'POST',
          pathname: '/api/checklists/checklist-id/items',
          query: {},
          body: {
            content: 'Prepare materials',
            parentItemId: 'parent-id',
            note: 'A short detail',
          },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })

  it('maps --github to the checklist item API input', async () => {
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/57'
    const response = { id: 'item-id', content: 'Build the feature' }
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
        'Build the feature',
        '--github',
        githubUrl,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/checklists/checklist-id/items',
          query: {},
          body: { content: 'Build the feature', github: githubUrl },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })
})

describe('checklist item update', () => {
  it('maps --clear-note to an explicit null note', async () => {
    const response = { id: 'item-id', note: null }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'checklist',
        'item',
        'update',
        'item-id',
        '--clear-note',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/checklist-items/item-id',
          query: {},
          body: { note: null },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })

  it('maps --github to the checklist item API input', async () => {
    const githubUrl = 'https://github.com/example-owner/example-repo/pull/61'
    const response = { id: 'item-id', githubLinkId: 'link-id' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'checklist',
        'item',
        'update',
        'item-id',
        '--github',
        githubUrl,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/checklist-items/item-id',
          query: {},
          body: { github: githubUrl },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })

  it('rejects --note-file together with --clear-note without sending a request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'checklist',
        'item',
        'update',
        'item-id',
        '--clear-note',
        '--note-file',
        'unused.md',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliFailure(exitCode, calls, stderr)).toEqual({
      exitCode: 1,
      requests: [],
      stderr: ['Error: Use either --note-file or --clear-note, not both.\n'],
    })
  })
})

describe('checklist item promote', () => {
  it('promotes an item through the API and prints the linked item', async () => {
    const response = {
      id: 'item-id',
      content: 'Build feature',
      subtaskId: 'subtask-id',
    }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'checklist', 'item', 'promote', 'item-id'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'POST',
          pathname: '/api/checklist-items/item-id/promote',
          query: {},
          body: undefined,
        },
      ],
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
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/checklist-items/item-id/move',
          query: {},
          body: { parentItemId: null },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })

  it('maps --first to an explicit null afterItemId', async () => {
    const response = { id: 'item-id', sortOrder: 0 }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(response), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'checklist', 'item', 'move', 'item-id', '--first'],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliRun(exitCode, calls, write)).toEqual({
      exitCode: 0,
      requests: [
        {
          method: 'PATCH',
          pathname: '/api/checklist-items/item-id/move',
          query: {},
          body: { afterItemId: null },
        },
      ],
      output: [[`${JSON.stringify(response, null, 2)}\n`]],
    })
  })

  it('rejects --first together with --after without sending a request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'checklist',
        'item',
        'move',
        'item-id',
        '--first',
        '--after',
        'sibling-id',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(summarizeCliFailure(exitCode, calls, stderr)).toEqual({
      exitCode: 1,
      requests: [],
      stderr: ['Error: Use either --after or --first, not both.\n'],
    })
  })
})

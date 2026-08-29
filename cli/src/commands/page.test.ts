import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  spyStderr,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('page list', () => {
  it('omits page content from the printed output by default', async () => {
    const pages = [{ id: 'p1', title: 'Notes', content: '# Hello' }]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(pages), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'page', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify([{ id: 'p1', title: 'Notes' }], null, 2)}\n`],
    ])
  })

  it('includes page content when --full is given', async () => {
    const pages = [{ id: 'p1', title: 'Notes', content: '# Hello' }]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(pages), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'page', 'list', '42', '--full'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([[`${JSON.stringify(pages, null, 2)}\n`]])
  })
})

describe('page get', () => {
  it('prints the whole page when --output is not given', async () => {
    const page = { id: 'p1', title: 'Notes', content: '# Hello' }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(page), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'page', 'get', '42', 'p1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([[`${JSON.stringify(page, null, 2)}\n`]])
  })

  describe('with --output', () => {
    let tmpDir: string | undefined

    afterEach(async () => {
      if (tmpDir != null) {
        await rm(tmpDir, { recursive: true, force: true })
        tmpDir = undefined
      }
    })

    it('writes content to the file and never prints it to stdout', async () => {
      const page = {
        id: 'p1',
        title: 'Notes',
        content: '# Secret content',
      }
      const { fetchStub } = captureFetch(
        () => new Response(JSON.stringify(page), { status: 200 }),
      )
      const write = spyStdout()

      tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-page-get-'))
      const outputPath = join(tmpDir, 'content.md')

      const exitCode = await runCli(
        [
          '--api-url',
          apiUrl,
          'page',
          'get',
          '42',
          'p1',
          '--output',
          outputPath,
        ],
        fetchStub,
        fakeStdin(true),
      )

      expect(exitCode).toBe(0)
      expect(write.mock.calls).toEqual([
        [`${JSON.stringify({ id: 'p1', title: 'Notes' }, null, 2)}\n`],
      ])
      await expect(readFile(outputPath, 'utf8')).resolves.toBe(
        '# Secret content',
      )
    })
  })
})

describe('page create', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('sends the content of --file as the request body content and prints the response', async () => {
    const created = { id: 'p1', title: 'Notes', content: '# From file' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-page-create-'))
    const filePath = join(tmpDir, 'content.md')
    await writeFile(filePath, '# From file', 'utf8')

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'page',
        'create',
        '42',
        'Notes',
        '--file',
        filePath,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ title: 'Notes', content: '# From file' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('prints the linkSync summary to stderr when the response includes one', async () => {
    const created = {
      id: 'p1',
      title: 'Notes',
      content: '# From file',
      linkSync: {
        outgoing: [],
        unresolvedRefs: [
          {
            kind: 'number',
            value: 465,
            sources: [{ kind: 'page', id: 'p1', title: 'Notes' }],
          },
        ],
      },
    }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const stderr = spyStderr()

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-page-create-'))
    const filePath = join(tmpDir, 'content.md')
    await writeFile(filePath, '# From file', 'utf8')

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'page',
        'create',
        '42',
        'Notes',
        '--file',
        filePath,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(stderr.mock.calls).toEqual([
      [
        'Task references with no matching task:\n' +
          '  #465 in page "Notes"\n' +
          "If these aren't tq task numbers, write them as a link or in backticks.\n",
      ],
    ])
  })

  it('omits content from the request body when neither --file nor stdin provide any', async () => {
    const created = { id: 'p1', title: 'Notes', content: '' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'page', 'create', '42', 'Notes'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ title: 'Notes' })
  })
})

describe('page update', () => {
  it('sends only the title field when only --title is given', async () => {
    const updated = { id: 'p1', title: 'New title' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'page',
        'update',
        '42',
        'p1',
        '--title',
        'New title',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ title: 'New title' })
  })

  it('prints the linkSync summary to stderr when the response includes one', async () => {
    const updated = {
      id: 'p1',
      title: 'New title',
      linkSync: {
        outgoing: [{ number: 76, title: 'Fix bug' }],
        unresolvedRefs: [],
      },
    }
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const stderr = spyStderr()

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'page',
        'update',
        '42',
        'p1',
        '--title',
        'New title',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(stderr.mock.calls).toEqual([['Linked tasks:\n  #76 Fix bug\n']])
  })
})

describe('global options', () => {
  it('sends configured headers with the request', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, '--header', 'X-Test: abc', 'page', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.headers).toEqual({ 'x-test': 'abc' })
  })

  it('sends X-Author derived from --author', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, '--author', 'claude-opus-5', 'page', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.headers).toEqual({ 'x-author': 'llm:claude-opus-5' })
  })

  it('omits X-Author when --author is not given', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'page', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.headers).toEqual({})
  })

  it('omits X-Author when --author is an empty string', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, '--author', '', 'page', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.headers).toEqual({})
  })

  it('lets an explicit -H override the X-Author derived from --author', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify([]), { status: 200 }),
    )

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        '--author',
        'claude-opus-5',
        '--header',
        'X-Author: llm:manual-override',
        'page',
        'list',
        '42',
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.headers).toEqual({ 'x-author': 'llm:manual-override' })
  })
})

describe('page delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'page', 'delete', '42', 'p1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify({ deleted: true, taskId: '42', pageId: 'p1' }, null, 2)}\n`,
      ],
    ])
  })
})

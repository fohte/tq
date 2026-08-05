import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import type { ReadableStdin } from '#input'

interface CapturedRequest {
  method: string
  url: string
  headers: Record<string, string>
  body: unknown
}

function captureFetch(respond: () => Response): {
  fetchStub: typeof fetch
  calls: CapturedRequest[]
} {
  const calls: CapturedRequest[] = []
  const fetchStub = ((input: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    calls.push({
      method: init?.method ?? 'GET',
      url:
        input instanceof URL
          ? input.toString()
          : input instanceof Request
            ? input.url
            : input,
      headers: Object.fromEntries(headers.entries()),
      body:
        typeof init?.body === 'string' && init.body.length > 0
          ? (JSON.parse(init.body) as unknown)
          : undefined,
    })
    return Promise.resolve(respond())
  }) as typeof fetch
  return { fetchStub, calls }
}

function fakeStdin(isTTY: boolean): ReadableStdin {
  const readable = Readable.from([])
  return Object.assign(readable, { isTTY })
}

function spyStdout() {
  return vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
}

const apiUrl = 'http://api.test'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('page list', () => {
  it('prints the pages returned by the server as JSON', async () => {
    const pages = [{ id: 'p1', title: 'Notes' }]
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

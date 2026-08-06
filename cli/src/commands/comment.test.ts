import { mkdtemp, rm, writeFile } from 'node:fs/promises'
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

describe('comment list', () => {
  it('prints the comments returned by the server as JSON', async () => {
    const comments = [{ id: 'c1', content: 'Hello' }]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(comments), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'list', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(comments, null, 2)}\n`],
    ])
  })
})

describe('comment create', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('sends the content of --file as the request body content and prints the response', async () => {
    const created = { id: 'c1', content: '# From file' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-comment-create-'))
    const filePath = join(tmpDir, 'content.md')
    await writeFile(filePath, '# From file', 'utf8')

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'create', '42', '--file', filePath],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ content: '# From file' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('sends an empty content string when neither --file nor stdin provide any', async () => {
    const created = { id: 'c1', content: '' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'create', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ content: '' })
  })
})

describe('comment update', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('sends the content of --file as the request body content and prints the response', async () => {
    const updated = { id: 'c1', content: '# Updated' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-comment-update-'))
    const filePath = join(tmpDir, 'content.md')
    await writeFile(filePath, '# Updated', 'utf8')

    const exitCode = await runCli(
      [
        '--api-url',
        apiUrl,
        'comment',
        'update',
        '42',
        'c1',
        '--file',
        filePath,
      ],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ content: '# Updated' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(updated, null, 2)}\n`],
    ])
  })
})

describe('comment delete', () => {
  it('prints a deletion confirmation', async () => {
    const { fetchStub } = captureFetch(
      () => new Response(null, { status: 204 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'delete', '42', 'c1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify({ deleted: true, taskId: '42', commentId: 'c1' }, null, 2)}\n`,
      ],
    ])
  })
})

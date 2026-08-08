import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import {
  apiUrl,
  captureFetch,
  fakeStdin,
  spyStdout,
} from '#commands/test-support'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('comment list', () => {
  it('omits comment content from the printed output by default', async () => {
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
      [`${JSON.stringify([{ id: 'c1' }], null, 2)}\n`],
    ])
  })

  it('includes comment content when --full is given', async () => {
    const comments = [{ id: 'c1', content: 'Hello' }]
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify(comments), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'list', '42', '--full'],
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

  it('sends piped stdin content as the request body content when --file is not given', async () => {
    const created = { id: 'c1', content: 'some piped content' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(created), { status: 201 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'create', '42'],
      fetchStub,
      Object.assign(Readable.from(['some piped content']), { isTTY: false }),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ content: 'some piped content' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(created, null, 2)}\n`],
    ])
  })

  it('exits non-zero and never calls fetch when neither --file nor stdin provide any content', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'create', '42'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls).toEqual([])
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

  it('sends piped stdin content as the request body content when --file is not given', async () => {
    const updated = { id: 'c1', content: 'some piped content' }
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify(updated), { status: 200 }),
    )
    const write = spyStdout()

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'update', '42', 'c1'],
      fetchStub,
      Object.assign(Readable.from(['some piped content']), { isTTY: false }),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({ content: 'some piped content' })
    expect(write.mock.calls).toEqual([
      [`${JSON.stringify(updated, null, 2)}\n`],
    ])
  })

  it('exits non-zero and never calls fetch when neither --file nor stdin provide any content', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'comment', 'update', '42', 'c1'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(1)
    expect(calls).toEqual([])
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

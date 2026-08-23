import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { runCli } from '#cli'
import { apiUrl, captureFetch, fakeStdin } from '#commands/test-support'
import type { ReadableStdin } from '#input'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function stdinWith(content: string): ReadableStdin {
  return Object.assign(Readable.from([content]), { isTTY: false })
}

describe('hook', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('reports SessionStart with the transcript-resolved label and lastMessage', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-hook-'))
    const transcriptPath = join(tmpDir, 'session.jsonl')
    await writeFile(
      transcriptPath,
      [
        JSON.stringify({ type: 'ai-title', aiTitle: 'Fix login bug' }),
        JSON.stringify({
          type: 'assistant',
          message: { content: [{ type: 'text', text: 'Done' }] },
        }),
      ].join('\n'),
      'utf8',
    )

    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      stdinWith(
        JSON.stringify({
          session_id: 'sess-1',
          cwd: '/home/user/app',
          transcript_path: transcriptPath,
        }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(calls).toEqual([
      {
        method: 'POST',
        url: `${apiUrl}/api/agent-sessions`,
        headers: { 'content-type': 'application/json' },
        body: {
          provider: 'claude_code',
          sessionId: 'sess-1',
          cwd: '/home/user/app',
          label: 'Fix login bug',
          lastMessage: 'Done',
          ended: false,
        },
      },
    ])
  })

  it('sets ended: true only for SessionEnd', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionEnd'],
      fetchStub,
      stdinWith(
        JSON.stringify({ session_id: 'sess-1', cwd: '/home/user/app' }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      provider: 'claude_code',
      sessionId: 'sess-1',
      cwd: '/home/user/app',
      label: 'app',
      lastMessage: null,
      ended: true,
    })
  })

  it('uses TQ_CONTEXT as the default context', async () => {
    vi.stubEnv('TQ_CONTEXT', 'work')
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'Stop'],
      fetchStub,
      stdinWith(
        JSON.stringify({ session_id: 'sess-1', cwd: '/home/user/app' }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      provider: 'claude_code',
      sessionId: 'sess-1',
      cwd: '/home/user/app',
      label: 'app',
      lastMessage: null,
      ended: false,
      context: 'work',
    })
  })

  it('falls back to the cwd basename when the transcript file does not exist', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      stdinWith(
        JSON.stringify({
          session_id: 'sess-1',
          cwd: '/home/user/app',
          transcript_path: '/nonexistent/path.jsonl',
        }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(calls[0]?.body).toEqual({
      provider: 'claude_code',
      sessionId: 'sess-1',
      cwd: '/home/user/app',
      label: 'app',
      lastMessage: null,
      ended: false,
    })
  })

  it('exits 0 and never calls fetch when stdin has no content', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      fakeStdin(true),
    )

    expect(exitCode).toBe(0)
    expect(calls.length).toBe(0)
  })

  it('exits 0 and never calls fetch when stdin is not valid JSON', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      stdinWith('not json'),
    )

    expect(exitCode).toBe(0)
    expect(calls.length).toBe(0)
  })

  it('exits 0 and never calls fetch when the hook payload is missing required fields', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      stdinWith(JSON.stringify({ cwd: '/home/user/app' })),
    )

    expect(exitCode).toBe(0)
    expect(calls.length).toBe(0)
  })

  it('exits 0 even when the API request fails', async () => {
    const fetchStub = (() =>
      Promise.reject(new Error('network down'))) as typeof fetch

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      stdinWith(
        JSON.stringify({ session_id: 'sess-1', cwd: '/home/user/app' }),
      ),
    )

    expect(exitCode).toBe(0)
  })

  it('appends TQ_SESSION_ID to CLAUDE_ENV_FILE on SessionStart', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-hook-'))
    const envFile = join(tmpDir, 'env.sh')
    await writeFile(envFile, 'export EXISTING=1\n', 'utf8')
    vi.stubEnv('CLAUDE_ENV_FILE', envFile)
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'SessionStart'],
      fetchStub,
      stdinWith(
        JSON.stringify({ session_id: "sess-1'quote", cwd: '/home/user/app' }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(await readFile(envFile, 'utf8')).toBe(
      "export EXISTING=1\nexport TQ_SESSION_ID='sess-1'\\''quote'\n",
    )
  })

  it('does not touch CLAUDE_ENV_FILE for events other than SessionStart', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-hook-'))
    const envFile = join(tmpDir, 'env.sh')
    await writeFile(envFile, 'export EXISTING=1\n', 'utf8')
    vi.stubEnv('CLAUDE_ENV_FILE', envFile)
    const { fetchStub } = captureFetch(
      () => new Response(JSON.stringify({ id: 's1' }), { status: 200 }),
    )

    const exitCode = await runCli(
      ['--api-url', apiUrl, 'hook', 'Stop'],
      fetchStub,
      stdinWith(
        JSON.stringify({ session_id: 'sess-1', cwd: '/home/user/app' }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(await readFile(envFile, 'utf8')).toBe('export EXISTING=1\n')
  })

  it('exits 0 without calling fetch when the API URL is not set', async () => {
    const { fetchStub, calls } = captureFetch(
      () => new Response(null, { status: 500 }),
    )

    const exitCode = await runCli(
      ['hook', 'SessionStart'],
      fetchStub,
      stdinWith(
        JSON.stringify({ session_id: 'sess-1', cwd: '/home/user/app' }),
      ),
    )

    expect(exitCode).toBe(0)
    expect(calls.length).toBe(0)
  })
})

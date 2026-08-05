import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { afterEach, describe, expect, it } from 'vitest'

import { FileIoError } from '#errors'
import type { ReadableStdin } from '#input'
import { readContentInput } from '#input'

function fakeStdin(chunks: string[], isTTY: boolean): ReadableStdin {
  // Real stdin streams emit Buffer chunks (not strings), which is what
  // readStreamText expects to Buffer.concat.
  const readable = Readable.from(chunks.map((chunk) => Buffer.from(chunk)))
  return Object.assign(readable, { isTTY })
}

describe('readContentInput', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('returns the file contents when filePath is given', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-input-'))
    const filePath = join(tmpDir, 'content.md')
    await writeFile(filePath, '# Hello', 'utf8')

    await expect(readContentInput(filePath, fakeStdin([], true))).resolves.toBe(
      '# Hello',
    )
  })

  it('throws FileIoError when the file does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-input-'))
    const filePath = join(tmpDir, 'missing.md')

    await expect(
      readContentInput(filePath, fakeStdin([], true)),
    ).rejects.toThrow(FileIoError)
  })

  it('returns undefined when stdin is a TTY', async () => {
    await expect(
      readContentInput(undefined, fakeStdin([], true)),
    ).resolves.toBeUndefined()
  })

  it('returns the piped text when stdin is not a TTY and has data', async () => {
    await expect(
      readContentInput(undefined, fakeStdin(['# From stdin'], false)),
    ).resolves.toBe('# From stdin')
  })

  it('returns undefined when stdin is not a TTY but is empty', async () => {
    await expect(
      readContentInput(undefined, fakeStdin([], false)),
    ).resolves.toBeUndefined()
  })
})

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { afterEach, describe, expect, it } from 'vitest'

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

    const result = await readContentInput(filePath, fakeStdin([], true))

    expect(result._unsafeUnwrap()).toBe('# Hello')
  })

  it('returns an Err(FileIoError) when the file does not exist', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-input-'))
    const filePath = join(tmpDir, 'missing.md')

    const result = await readContentInput(filePath, fakeStdin([], true))

    expect(result._unsafeUnwrapErr().message).toBe(`Failed to read ${filePath}`)
  })

  it('does not read stdin when filePath is not given', async () => {
    const stdin: ReadableStdin = {
      [Symbol.asyncIterator]() {
        throw new Error('stdin must not be read')
      },
    }
    const result = await readContentInput(undefined, stdin)

    expect(result._unsafeUnwrap()).toEqual(undefined)
  })

  it('returns the piped text when filePath is -', async () => {
    const result = await readContentInput(
      '-',
      fakeStdin(['# From stdin'], true),
    )

    expect(result._unsafeUnwrap()).toBe('# From stdin')
  })

  it('returns undefined when explicitly selected stdin is empty', async () => {
    const result = await readContentInput('-', fakeStdin([], false))

    expect(result._unsafeUnwrap()).toBeUndefined()
  })
})

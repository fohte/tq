import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FileIoError } from '#errors'
import { printJson, writeContentFile } from '#output'

describe('printJson', () => {
  it('writes the value as pretty-printed JSON followed by a newline', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    printJson({ id: '1', title: 'Hello' })

    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith(
      `${JSON.stringify({ id: '1', title: 'Hello' }, null, 2)}\n`,
    )

    write.mockRestore()
  })
})

describe('writeContentFile', () => {
  let tmpDir: string | undefined

  afterEach(async () => {
    if (tmpDir != null) {
      await rm(tmpDir, { recursive: true, force: true })
      tmpDir = undefined
    }
  })

  it('writes the content to the given file', async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tq-cli-output-'))
    const filePath = join(tmpDir, 'content.md')

    await writeContentFile(filePath, '# Hello')

    await expect(readFile(filePath, 'utf8')).resolves.toBe('# Hello')
  })

  it('throws FileIoError when the file cannot be written', async () => {
    const filePath = join(tmpdir(), 'tq-cli-output-missing-dir', 'content.md')

    await expect(writeContentFile(filePath, '# Hello')).rejects.toThrow(
      FileIoError,
    )
  })
})

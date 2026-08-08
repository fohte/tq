import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { FileIoError } from '#errors'
import { printJson, printJsonList, writeContentFile } from '#output'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('printJson', () => {
  it('writes the value as pretty-printed JSON followed by a newline', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    printJson({ id: '1', title: 'Hello' })

    expect(write.mock.calls).toEqual([
      [`${JSON.stringify({ id: '1', title: 'Hello' }, null, 2)}\n`],
    ])
  })
})

describe('printJsonList', () => {
  it('omits the given key from every item by default', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    printJsonList(
      [
        { id: '1', title: 'Hello', content: 'long body' },
        { id: '2', title: 'World', content: 'another long body' },
      ],
      'content',
    )

    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          [
            { id: '1', title: 'Hello' },
            { id: '2', title: 'World' },
          ],
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('recursively omits the key from nested arrays, e.g. a task tree children field', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    printJsonList(
      [
        {
          id: '1',
          description: 'root body',
          children: [{ id: '2', description: 'child body', children: [] }],
        },
      ],
      'description',
    )

    expect(write.mock.calls).toEqual([
      [
        `${JSON.stringify(
          [{ id: '1', children: [{ id: '2', children: [] }] }],
          null,
          2,
        )}\n`,
      ],
    ])
  })

  it('keeps the key when full is true', () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)

    const items = [{ id: '1', title: 'Hello', content: 'long body' }]
    printJsonList(items, 'content', { full: true })

    expect(write.mock.calls).toEqual([[`${JSON.stringify(items, null, 2)}\n`]])
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

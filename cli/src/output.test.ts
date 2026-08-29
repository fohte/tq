import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  printJson,
  printJsonList,
  printLinkSync,
  writeContentFile,
} from '#output'

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

describe('printLinkSync', () => {
  it('writes nothing when linkSync is undefined', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    printLinkSync(undefined)

    expect(write.mock.calls).toEqual([])
  })

  it('writes nothing when both outgoing and unresolvedRefs are empty', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    printLinkSync({ outgoing: [], unresolvedRefs: [] })

    expect(write.mock.calls).toEqual([])
  })

  it('writes only the linked-tasks block when only outgoing is non-empty', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    printLinkSync({
      outgoing: [
        { number: 76, title: 'Fix bug' },
        { number: 12, title: 'Add feature' },
      ],
      unresolvedRefs: [],
    })

    expect(write.mock.calls).toEqual([
      ['Linked tasks:\n  #76 Fix bug\n  #12 Add feature\n'],
    ])
  })

  it('writes only the unresolved-refs block when only unresolvedRefs is non-empty', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    printLinkSync({
      outgoing: [],
      unresolvedRefs: [
        { kind: 'number', value: 465, sources: [{ kind: 'description' }] },
        {
          kind: 'id',
          value: 'abc123',
          sources: [
            { kind: 'comment', id: '3f2a1c9e-0000-0000-0000-000000000000' },
          ],
        },
      ],
    })

    expect(write.mock.calls).toEqual([
      [
        'Task references with no matching task:\n' +
          '  #465 in description\n' +
          '  abc123 in comment 3f2a1c9e-0000-0000-0000-000000000000\n' +
          "If these aren't tq task numbers, write them as a link or in backticks.\n",
      ],
    ])
  })

  it('writes both blocks when outgoing and unresolvedRefs are both non-empty', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    printLinkSync({
      outgoing: [{ number: 76, title: 'Fix bug' }],
      unresolvedRefs: [
        {
          kind: 'number',
          value: 465,
          sources: [{ kind: 'page', id: 'p1', title: 'Notes' }],
        },
      ],
    })

    expect(write.mock.calls).toEqual([
      [
        'Linked tasks:\n' +
          '  #76 Fix bug\n' +
          'Task references with no matching task:\n' +
          '  #465 in page "Notes"\n' +
          "If these aren't tq task numbers, write them as a link or in backticks.\n",
      ],
    ])
  })

  it('lists every field a ref appeared in when it is unresolved in more than one', () => {
    const write = vi
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true)

    printLinkSync({
      outgoing: [],
      unresolvedRefs: [
        {
          kind: 'number',
          value: 465,
          sources: [
            { kind: 'description' },
            { kind: 'page', id: 'p1', title: 'Notes' },
          ],
        },
      ],
    })

    expect(write.mock.calls).toEqual([
      [
        'Task references with no matching task:\n' +
          '  #465 in description, page "Notes"\n' +
          "If these aren't tq task numbers, write them as a link or in backticks.\n",
      ],
    ])
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

    const result = await writeContentFile(filePath, '# Hello')
    result._unsafeUnwrap()

    await expect(readFile(filePath, 'utf8')).resolves.toBe('# Hello')
  })

  it('returns an Err(FileIoError) when the file cannot be written', async () => {
    const filePath = join(tmpdir(), 'tq-cli-output-missing-dir', 'content.md')

    const result = await writeContentFile(filePath, '# Hello')

    expect(result._unsafeUnwrapErr().message).toBe(
      `Failed to write ${filePath}`,
    )
  })
})

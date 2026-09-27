import type { CliOutput } from 'api/operations'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { printOperationOutput } from '#operation-output'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('printOperationOutput', () => {
  it('omits the configured key when no full field is configured', async () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const value = [{ id: '1', title: 'Example', description: 'long body' }]
    const output = {
      kind: 'list',
      omitKey: 'description',
    } satisfies Extract<CliOutput, { kind: 'list' }>

    const result = await printOperationOutput(output, value, {}, fetch)

    const actual = () => ({ isError: result.isErr(), writes: write.mock.calls })

    expect(actual()).toEqual({
      isError: false,
      writes: [
        [`${JSON.stringify([{ id: '1', title: 'Example' }], null, 2)}\n`],
      ],
    })
  })

  it('prints the operation response when a full field is configured', async () => {
    const write = vi
      .spyOn(process.stdout, 'write')
      .mockImplementation(() => true)
    const value = [{ id: '1', title: 'Example', description: 'long body' }]
    const output = {
      kind: 'list',
      fullField: 'full',
    } satisfies Extract<CliOutput, { kind: 'list' }>

    const result = await printOperationOutput(output, value, {}, fetch)

    const actual = () => ({ isError: result.isErr(), writes: write.mock.calls })

    expect(actual()).toEqual({
      isError: false,
      writes: [[`${JSON.stringify(value, null, 2)}\n`]],
    })
  })
})

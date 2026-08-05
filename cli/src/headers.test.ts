import { InvalidArgumentError } from 'commander'
import { describe, expect, it } from 'vitest'

import { collectHeader } from '#headers'

describe('collectHeader', () => {
  it('parses "Name: Value" into a header entry', () => {
    expect(collectHeader('Name: Value', {})).toEqual({ Name: 'Value' })
  })

  it('merges with previously collected headers', () => {
    const first = collectHeader('X-One: 1', {})
    const second = collectHeader('X-Two: 2', first)

    expect(second).toEqual({ 'X-One': '1', 'X-Two': '2' })
  })

  it('throws InvalidArgumentError when there is no colon separator', () => {
    expect(() => collectHeader('NoColon', {})).toThrow(InvalidArgumentError)
  })
})

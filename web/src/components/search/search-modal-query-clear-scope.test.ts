import { describe, expect, it } from 'vitest'

import { removeSearchContextTokens } from '#components/search/search-modal-query-clear-scope'

describe('removeSearchContextTokens', () => {
  it('removes parsed context tokens while preserving quoted and invalid text', () => {
    expect(
      removeSearchContextTokens('"a context:work b" context:work context:WORK'),
    ).toBe('"a context:work b" context:WORK')
  })
})

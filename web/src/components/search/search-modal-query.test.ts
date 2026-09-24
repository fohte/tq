import { describe, expect, it } from 'vitest'

import {
  addSearchScope,
  extractSearchScopeTokens,
  removeLastSearchScopeToken,
  stripSearchScopeTokens,
} from '#components/search/search-modal-query'

describe('search modal query scopes', () => {
  it('extracts completed scope tokens', () => {
    const projectId = '00000000-0000-0000-0000-000000000101'

    expect(extractSearchScopeTokens(`project:${projectId} keyboard `)).toEqual([
      `project:${projectId}`,
    ])
  })

  it('preserves editable trailing whitespace after hiding scopes', () => {
    const projectId = '00000000-0000-0000-0000-000000000101'

    expect(stripSearchScopeTokens(`project:${projectId} keyboard `)).toBe(
      'keyboard ',
    )
  })

  it('removes one quoted scope token at a time', () => {
    expect(
      removeLastSearchScopeToken('project:"my project" parent:task '),
    ).toBe('project:"my project" ')
  })

  it('drops free text while preserving filters and earlier scopes', () => {
    const projectId = '00000000-0000-0000-0000-000000000101'
    const taskId = '00000000-0000-0000-0000-000000000102'

    expect(
      addSearchScope(
        `project:${projectId} keyboard is:todo `,
        `parent:${taskId}`,
      ),
    ).toBe(`project:${projectId} is:todo parent:${taskId} `)
  })
})

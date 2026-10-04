import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { useSearchModalQuery } from '#components/search/search-modal-query'

describe('useSearchModalQuery', () => {
  it('preserves editable trailing whitespace after hiding scopes', () => {
    const projectId = '00000000-0000-0000-0000-000000000101'
    const { result } = renderHook(() =>
      useSearchModalQuery(`project:${projectId} keyboard `, () => {}, {
        current: null,
      }),
    )

    expect(result.current.searchInputValue).toBe('keyboard ')
  })

  it('drops free text while preserving filters and earlier scopes', () => {
    const projectId = '00000000-0000-0000-0000-000000000101'
    const taskId = '00000000-0000-0000-0000-000000000102'
    const setQuery = vi.fn()
    const { result } = renderHook(() =>
      useSearchModalQuery(`project:${projectId} keyboard is:todo `, setQuery, {
        current: null,
      }),
    )

    result.current.applyScope(`parent:${taskId}`)

    expect(setQuery.mock.calls).toEqual([
      [`project:${projectId} is:todo parent:${taskId} `],
    ])
  })
})

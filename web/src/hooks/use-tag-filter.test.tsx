import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'

import {
  TagFilterProvider,
  useTagFilter,
  useTagToggle,
} from '#hooks/use-tag-filter'

function wrapper({ children }: { children: ReactNode }) {
  return <TagFilterProvider>{children}</TagFilterProvider>
}

describe('useTagFilter', () => {
  it('defaults to null (no filter)', () => {
    const { result } = renderHook(() => useTagFilter(), { wrapper })
    expect(result.current.tag).toBeNull()
  })

  it('updates tag', () => {
    const { result } = renderHook(() => useTagFilter(), { wrapper })
    act(() => {
      result.current.setTag('urgent')
    })
    expect(result.current.tag).toBe('urgent')
  })

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useTagFilter())
    }).toThrow('useTagFilter must be used within a TagFilterProvider')
  })
})

describe('useTagToggle', () => {
  it('is inactive when no tag is selected', () => {
    const { result } = renderHook(() => useTagToggle('urgent'), { wrapper })
    expect(result.current.isActive).toBe(false)
  })

  it('becomes active when toggled on', () => {
    const { result } = renderHook(() => useTagToggle('urgent'), { wrapper })
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isActive).toBe(true)
  })

  it('becomes inactive when toggled again', () => {
    const { result } = renderHook(() => useTagToggle('urgent'), { wrapper })
    act(() => {
      result.current.toggle()
    })
    act(() => {
      result.current.toggle()
    })
    expect(result.current.isActive).toBe(false)
  })

  it('is inactive when a different tag is selected', () => {
    function useCombined() {
      return { filter: useTagFilter(), toggle: useTagToggle('urgent') }
    }
    const { result } = renderHook(() => useCombined(), { wrapper })
    act(() => {
      result.current.filter.setTag('other')
    })
    expect(result.current.toggle.isActive).toBe(false)
  })
})

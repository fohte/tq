import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useResizableWidth } from '#hooks/use-resizable-width'

const STORAGE_KEY = 'test:resizable-width'

describe('useResizableWidth', () => {
  beforeEach(() => {
    localStorage.removeItem(STORAGE_KEY)
  })

  it('persists a changed width for a newly mounted instance', () => {
    const { result } = renderHook(() =>
      useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 500,
      }),
    )

    act(() => {
      result.current[1](555)
    })

    const { result: reloaded } = renderHook(() =>
      useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 500,
      }),
    )

    const getWidthState = () => ({
      width: result.current[0],
      persistedWidth: localStorage.getItem(STORAGE_KEY),
      reloadedWidth: reloaded.current[0],
    })
    expect(getWidthState()).toEqual({
      width: 500,
      persistedWidth: '500',
      reloadedWidth: 500,
    })
  })

  it('clamps a stored width to the configured bounds', () => {
    localStorage.setItem(STORAGE_KEY, '120')

    const { result } = renderHook(() =>
      useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 500,
      }),
    )

    expect(result.current[0]).toEqual(240)
  })
})

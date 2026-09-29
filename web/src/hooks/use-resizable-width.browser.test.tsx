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
      result.current.onValueCommit(555)
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
      width: result.current.width,
      persistedWidth: localStorage.getItem(STORAGE_KEY),
      reloadedWidth: reloaded.current.width,
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

    expect(result.current.width).toEqual(240)
  })

  it('falls back when the stored width is malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-a-width')

    const { result } = renderHook(() =>
      useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 500,
      }),
    )

    expect(result.current.width).toEqual(320)
  })

  it('resolves a function default width on first mount', () => {
    const { result } = renderHook(() =>
      useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: () => 400,
        minWidth: 240,
        maxWidth: 500,
      }),
    )

    expect(result.current.width).toEqual(400)
  })

  it('limits the displayed width without overwriting the saved preference', () => {
    localStorage.setItem(STORAGE_KEY, '400')

    const { result } = renderHook(() =>
      useResizableWidth({
        storageKey: STORAGE_KEY,
        defaultWidth: 320,
        minWidth: 240,
        maxWidth: 500,
        responsiveMaxWidth: () => 300,
      }),
    )

    const getWidthState = () => ({
      width: result.current.width,
      maxWidth: result.current.maxWidth,
      persistedWidth: localStorage.getItem(STORAGE_KEY),
    })
    expect(getWidthState()).toEqual({
      width: 300,
      maxWidth: 300,
      persistedWidth: '400',
    })
  })
})

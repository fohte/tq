import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  STORAGE_KEY,
  useSessionOpenSettings,
} from '#hooks/use-session-open-settings'

beforeEach(() => {
  localStorage.clear()
})

describe('useSessionOpenSettings', () => {
  it('defaults to personal context and no templates when nothing is stored', () => {
    const { result } = renderHook(() => useSessionOpenSettings())

    expect(result.current[0]).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })

  it('reads a previously stored value', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        localContext: 'work',
        focusUrlTemplate: 'hammerspoon://focus?session={sessionId}',
        resumeUrlTemplate: null,
      }),
    )

    const { result } = renderHook(() => useSessionOpenSettings())

    expect(result.current[0]).toEqual({
      localContext: 'work',
      focusUrlTemplate: 'hammerspoon://focus?session={sessionId}',
      resumeUrlTemplate: null,
    })
  })

  it('falls back to defaults when the stored value is malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json')

    const { result } = renderHook(() => useSessionOpenSettings())

    expect(result.current[0]).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })

  it('discards an unrecognized localContext value from a syntactically valid stored object', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        localContext: 'invalid',
        focusUrlTemplate: null,
        resumeUrlTemplate: null,
      }),
    )

    const { result } = renderHook(() => useSessionOpenSettings())

    expect(result.current[0]).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })

  it('merges a partial update with the existing settings', () => {
    const { result } = renderHook(() => useSessionOpenSettings())

    act(() => {
      result.current[1]({ localContext: 'personal' })
    })

    expect(result.current[0]).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })

  it('persists an update so a newly mounted instance reads it back', () => {
    const { result } = renderHook(() => useSessionOpenSettings())

    act(() => {
      result.current[1]({ localContext: 'personal' })
    })

    const { result: reloaded } = renderHook(() => useSessionOpenSettings())

    expect(reloaded.current[0]).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })

  it('reflects an update from one already-mounted instance in another', () => {
    function useCombined() {
      return { a: useSessionOpenSettings(), b: useSessionOpenSettings() }
    }
    const { result } = renderHook(() => useCombined())

    act(() => {
      result.current.a[1]({ localContext: 'work' })
    })

    expect(result.current.b[0].localContext).toBe('work')
  })
})

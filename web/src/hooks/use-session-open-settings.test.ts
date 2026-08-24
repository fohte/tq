import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSessionOpenSettings } from '#hooks/use-session-open-settings'

const STORAGE_KEY = 'tq:session-open-settings'

beforeEach(() => {
  localStorage.clear()
})

describe('useSessionOpenSettings', () => {
  it('defaults to no local context and no templates when nothing is stored', () => {
    const { result } = renderHook(() => useSessionOpenSettings())

    expect(result.current[0]).toEqual({
      localContext: null,
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
      localContext: null,
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })

  it('persists a partial update and merges it with the existing settings', () => {
    const { result } = renderHook(() => useSessionOpenSettings())

    act(() => {
      result.current[1]({ localContext: 'personal' })
    })

    expect(result.current[0]).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '')).toEqual({
      localContext: 'personal',
      focusUrlTemplate: null,
      resumeUrlTemplate: null,
    })
  })
})

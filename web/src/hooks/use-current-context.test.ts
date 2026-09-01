import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetSessionOpenSettings } from '#hooks/session-open-settings-test-fixtures'
import { useCurrentContext } from '#hooks/use-current-context'

beforeEach(() => {
  localStorage.clear()
})

describe('useCurrentContext', () => {
  it('reads the machine-configured context', () => {
    resetSessionOpenSettings({ localContext: 'work' })
    const { result } = renderHook(() => useCurrentContext())
    expect(result.current).toBe('work')
  })

  it('defaults to personal when unset', () => {
    const { result } = renderHook(() => useCurrentContext())
    expect(result.current).toBe('personal')
  })
})

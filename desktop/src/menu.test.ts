import { describe, expect, it } from 'vitest'

import { goBack, goForward, type NavigationHistory } from '#menu'

// Records which history methods were called; `canGo` decides whether the
// history has an entry in either direction.
const fakeHistory = (canGo: boolean) => {
  const calls: string[] = []
  const history: NavigationHistory = {
    canGoBack: () => canGo,
    goBack: () => calls.push('goBack'),
    canGoForward: () => canGo,
    goForward: () => calls.push('goForward'),
  }
  return { calls, history }
}

describe('history navigation', () => {
  it('goes back and forward when the history has an entry to go to', () => {
    const { calls, history } = fakeHistory(true)

    goBack(history)
    goForward(history)

    expect(calls).toEqual(['goBack', 'goForward'])
  })

  it('does nothing when the history has no entry to go to', () => {
    const { calls, history } = fakeHistory(false)

    goBack(history)
    goForward(history)

    expect(calls).toEqual([])
  })
})

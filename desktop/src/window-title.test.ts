import { describe, expect, it } from 'vitest'

import { setSideWindowTitle } from '#window-title'

describe('setSideWindowTitle', () => {
  it('keeps the side window title when the page title changes', () => {
    const effects: {
      title: string | undefined
      eventName: string | undefined
      prevented: boolean
    } = {
      title: undefined,
      eventName: undefined,
      prevented: false,
    }
    let onPageTitleUpdated:
      ((event: { preventDefault: () => void }) => void) | undefined
    const win = {
      setTitle: (title: string) => {
        effects.title = title
      },
      on: (
        eventName: 'page-title-updated',
        listener: (event: { preventDefault: () => void }) => void,
      ) => {
        effects.eventName = eventName
        onPageTitleUpdated = listener
      },
    }

    setSideWindowTitle(win)
    onPageTitleUpdated?.({
      preventDefault: () => {
        effects.prevented = true
      },
    })

    expect(effects).toEqual({
      title: 'tq (Side Window)',
      eventName: 'page-title-updated',
      prevented: true,
    })
  })
})

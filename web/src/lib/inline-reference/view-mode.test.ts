import { describe, expect, it } from 'vitest'

import { createInlineReferenceViewModeStore } from '#lib/inline-reference/view-mode'

describe('createInlineReferenceViewModeStore', () => {
  it('starts at the given initial mode', () => {
    const store = createInlineReferenceViewModeStore('view')

    expect(store.getMode()).toEqual('view')
  })

  it('reflects the mode passed to setMode', () => {
    const store = createInlineReferenceViewModeStore('view')

    store.setMode('edit')

    expect(store.getMode()).toEqual('edit')
  })

  it('keeps separate instances independent', () => {
    const a = createInlineReferenceViewModeStore('view')
    const b = createInlineReferenceViewModeStore('view')

    a.setMode('edit')

    expect(a.getMode()).toEqual('edit')
    expect(b.getMode()).toEqual('view')
  })
})

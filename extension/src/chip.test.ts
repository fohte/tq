import { beforeEach, describe, expect, it } from 'vitest'

import { chipAppearance, type ChipState, syncChipNextTo } from '#chip'
import { TQ_ORIGIN } from '#config'

describe('chipAppearance', () => {
  it('renders a linked task', () => {
    const state: ChipState = {
      kind: 'linked',
      taskId: 'uuid-1',
      taskNumber: 42,
    }

    expect(chipAppearance(state)).toEqual({
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })
  })

  it('renders an unlinked issue/PR', () => {
    const state: ChipState = { kind: 'unlinked' }

    expect(chipAppearance(state)).toEqual({
      text: '+ tq',
      href: null,
      variant: 'empty',
    })
  })

  it('renders nothing when the lookup failed', () => {
    const state: ChipState = { kind: 'error' }

    expect(chipAppearance(state)).toBeNull()
  })
})

describe('syncChipNextTo', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div data-component="StateLabel">Open</div>'
  })

  function stateLabel(): Element {
    const el = document.querySelector('[data-component="StateLabel"]')
    if (el === null) throw new Error('state label not found in test fixture')
    return el
  }

  it('inserts the chip as the next sibling of the state label', () => {
    syncChipNextTo(stateLabel(), {
      text: '+ tq',
      href: null,
      variant: 'empty',
    })

    expect(document.body.innerHTML).toBe(
      '<div data-component="StateLabel">Open</div><a data-tq-chip="empty">+ tq</a>',
    )
  })

  it('sets the href when the appearance has one', () => {
    syncChipNextTo(stateLabel(), {
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })

    expect(document.body.innerHTML).toBe(
      `<div data-component="StateLabel">Open</div><a data-tq-chip="linked" href="${TQ_ORIGIN}/tasks/uuid-1">tq #42</a>`,
    )
  })

  it('updates the existing chip in place instead of inserting a second one', () => {
    syncChipNextTo(stateLabel(), {
      text: '+ tq',
      href: null,
      variant: 'empty',
    })
    syncChipNextTo(stateLabel(), {
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })

    expect(document.body.innerHTML).toBe(
      `<div data-component="StateLabel">Open</div><a data-tq-chip="linked" href="${TQ_ORIGIN}/tasks/uuid-1">tq #42</a>`,
    )
  })

  it('finds the existing chip even when another element lands between it and the label', () => {
    syncChipNextTo(stateLabel(), { text: '+ tq', href: null, variant: 'empty' })

    const badge = document.createElement('span')
    stateLabel().insertAdjacentElement('afterend', badge)

    syncChipNextTo(stateLabel(), {
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })

    expect(document.body.innerHTML).toBe(
      `<div data-component="StateLabel">Open</div><span></span><a data-tq-chip="linked" href="${TQ_ORIGIN}/tasks/uuid-1">tq #42</a>`,
    )
  })

  it('clears the href when an existing chip becomes unlinked', () => {
    syncChipNextTo(stateLabel(), {
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })
    syncChipNextTo(stateLabel(), {
      text: '+ tq',
      href: null,
      variant: 'empty',
    })

    expect(document.body.innerHTML).toBe(
      '<div data-component="StateLabel">Open</div><a data-tq-chip="empty">+ tq</a>',
    )
  })

  it('adopts a chip already placed by another instance of this script instead of duplicating it', () => {
    document.body.innerHTML =
      '<div data-component="StateLabel">Open</div><a data-tq-chip="empty">+ tq</a>'

    syncChipNextTo(stateLabel(), {
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })

    expect(document.body.innerHTML).toBe(
      `<div data-component="StateLabel">Open</div><a data-tq-chip="linked" href="${TQ_ORIGIN}/tasks/uuid-1">tq #42</a>`,
    )
  })

  it('recovers the chip when another script rewraps the state label in a new parent', () => {
    syncChipNextTo(stateLabel(), { text: '+ tq', href: null, variant: 'empty' })

    // Simulate a third-party extension (e.g. Refined GitHub) rewrapping the
    // state label in a freshly created parent, leaving the old chip behind.
    const wrapper = document.createElement('a')
    document.body.append(wrapper)
    wrapper.append(stateLabel())

    syncChipNextTo(stateLabel(), {
      text: 'tq #42',
      href: `${TQ_ORIGIN}/tasks/uuid-1`,
      variant: 'linked',
    })

    expect(document.body.innerHTML).toBe(
      `<a><div data-component="StateLabel">Open</div><a data-tq-chip="linked" href="${TQ_ORIGIN}/tasks/uuid-1">tq #42</a></a>`,
    )
  })

  it('removes the chip when the appearance becomes null', () => {
    syncChipNextTo(stateLabel(), {
      text: '+ tq',
      href: null,
      variant: 'empty',
    })
    syncChipNextTo(stateLabel(), null)

    expect(document.body.innerHTML).toBe(
      '<div data-component="StateLabel">Open</div>',
    )
  })

  it('does not touch the DOM when called again with the same appearance', async () => {
    const appearance = { text: '+ tq', href: null, variant: 'empty' as const }
    syncChipNextTo(stateLabel(), appearance)

    const mutations: MutationRecord[] = []
    const observer = new MutationObserver((records) =>
      mutations.push(...records),
    )
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    syncChipNextTo(stateLabel(), appearance)
    await Promise.resolve()
    observer.disconnect()

    expect(mutations).toEqual([])
  })
})

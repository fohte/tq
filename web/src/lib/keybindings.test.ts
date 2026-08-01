import { describe, expect, it } from 'vitest'

import { allKeybindings } from '#lib/keybindings'

describe('allKeybindings', () => {
  it('has no duplicate key combinations', () => {
    const keys = allKeybindings.map((keybinding) => keybinding.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no duplicate ids', () => {
    const ids = allKeybindings.map((keybinding) => keybinding.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

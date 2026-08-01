import { describe, expect, it } from 'vitest'

import { allKeybindings, navKeybindings } from '#lib/keybindings'

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

describe('navKeybindings', () => {
  // use-global-keybindings.ts matches the second keystroke via a hardcoded
  // `g ${key}` template, so every entry must follow this exact shape.
  it('every entry follows the "g <char>" chord shape', () => {
    for (const keybinding of Object.values(navKeybindings)) {
      expect(keybinding.keys).toMatch(/^g .$/)
    }
  })
})

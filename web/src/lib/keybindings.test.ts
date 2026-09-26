import { describe, expect, it } from 'vitest'

import {
  calendarKeybindings,
  getAllKeybindings,
  getSearchKeybinding,
  navKeybindings,
} from '#lib/keybindings'

describe('getSearchKeybinding', () => {
  it.each(['MacIntel', 'iPhone', 'iPad', 'iPod'])(
    'uses Cmd+K on %s',
    (platform) => {
      expect(getSearchKeybinding(platform)).toEqual({
        id: 'search',
        keys: '⌘K',
        description: 'search tasks',
        modifier: 'meta',
      })
    },
  )

  it.each(['Win32', 'Linux x86_64'])('uses Ctrl+K on %s', (platform) => {
    expect(getSearchKeybinding(platform)).toEqual({
      id: 'search',
      keys: 'Ctrl+K',
      description: 'search tasks',
      modifier: 'ctrl',
    })
  })
})

describe('getAllKeybindings', () => {
  const allKeybindings = getAllKeybindings(getSearchKeybinding('MacIntel'))

  it('has no duplicate key combinations', () => {
    const keys = allKeybindings.map((keybinding) => keybinding.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no duplicate ids', () => {
    const ids = allKeybindings.map((keybinding) => keybinding.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('calendarKeybindings', () => {
  it('has no duplicate key combinations', () => {
    const keys = calendarKeybindings.map((keybinding) => keybinding.keys)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('has no duplicate ids', () => {
    const ids = calendarKeybindings.map((keybinding) => keybinding.id)
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

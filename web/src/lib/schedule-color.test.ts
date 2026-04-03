import { scheduleColorToEventColor } from '@web/lib/schedule-color'
import { describe, expect, it } from 'vitest'

describe('scheduleColorToEventColor', () => {
  it('returns default purple colors when color is null', () => {
    const result = scheduleColorToEventColor(null)
    expect(result).toEqual({ bg: '#2D2B55', accent: '#6C63FF' })
  })

  it('uses the custom color as accent and darkens it for bg', () => {
    const result = scheduleColorToEventColor('#52B788')
    expect(result.accent).toBe('#52B788')
    // bg should be darker than the accent
    expect(result.bg).not.toBe('#52B788')
    expect(result.bg).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('returns a valid hex bg for various colors', () => {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFFFF', '#000000']
    for (const color of colors) {
      const result = scheduleColorToEventColor(color)
      expect(result.accent).toBe(color)
      expect(result.bg).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  it('darkens black to black', () => {
    const result = scheduleColorToEventColor('#000000')
    expect(result).toEqual({ bg: '#000000', accent: '#000000' })
  })
})

import { describe, expect, it } from 'vitest'

import { scheduleColorToEventColor } from '#lib/schedule-color'

describe('scheduleColorToEventColor', () => {
  it('returns the default purple accent when color is null', () => {
    const result = scheduleColorToEventColor(null)
    expect(result).toEqual({ accent: '#6C63FF' })
  })

  it('returns the default purple accent when color is an empty string', () => {
    const result = scheduleColorToEventColor('')
    expect(result).toEqual({ accent: '#6C63FF' })
  })

  it('uses the custom color as accent', () => {
    const result = scheduleColorToEventColor('#52B788')
    expect(result).toEqual({ accent: '#52B788' })
  })
})

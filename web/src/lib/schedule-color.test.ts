import { scheduleColorToEventColor } from '@web/lib/schedule-color'
import { describe, expect, it } from 'vitest'

describe('scheduleColorToEventColor', () => {
  it('returns default purple colors when color is null', () => {
    const result = scheduleColorToEventColor(null)
    expect(result).toEqual({ bg: '#2D2B55', accent: '#6C63FF' })
  })

  it('uses the custom color as accent and darkens it for bg', () => {
    // #52B788: R=82, G=183, B=136. With factor=0.7: R=25, G=55, B=41
    const result = scheduleColorToEventColor('#52B788')
    expect(result).toEqual({ accent: '#52B788', bg: '#193729' })
  })

  it('darkens white to 30% brightness', () => {
    // #FFFFFF with factor=0.7: each channel 255 * 0.3 = 77 = 0x4d
    const result = scheduleColorToEventColor('#FFFFFF')
    expect(result).toEqual({ accent: '#FFFFFF', bg: '#4d4d4d' })
  })

  it('darkens pure red correctly', () => {
    // #FF0000 with factor=0.7: R=255*0.3=77, G=0, B=0
    const result = scheduleColorToEventColor('#FF0000')
    expect(result).toEqual({ accent: '#FF0000', bg: '#4d0000' })
  })

  it('darkens black to black', () => {
    const result = scheduleColorToEventColor('#000000')
    expect(result).toEqual({ bg: '#000000', accent: '#000000' })
  })
})

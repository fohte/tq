import type { ColorSwatchOption } from '#components/color-swatch-radio-group'

export function makeColorSwatchOption(
  overrides: Partial<ColorSwatchOption> = {},
): ColorSwatchOption {
  return {
    name: 'Coral',
    hex: '#EF6B6B',
    ...overrides,
  }
}

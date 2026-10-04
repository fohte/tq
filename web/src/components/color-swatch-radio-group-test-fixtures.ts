import type { ComponentProps } from 'react'

import type { ColorSwatchRadioGroup } from '#components/color-swatch-radio-group'

type ColorSwatchOption = ComponentProps<
  typeof ColorSwatchRadioGroup
>['options'][number]

export function makeColorSwatchOption(
  overrides: Partial<ColorSwatchOption> = {},
): ColorSwatchOption {
  return {
    name: 'Coral',
    hex: '#EF6B6B',
    ...overrides,
  }
}

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import type { CSSProperties } from 'react'

import { cn } from '#lib/utils'

export interface ColorSwatchOption {
  name: string
  hex: string
}

interface ColorSwatchRadioGroupProps {
  options: readonly ColorSwatchOption[]
  value: string
  onValueChange: (value: string) => void
  clearOnReselect?: boolean
}

export function ColorSwatchRadioGroup({
  options,
  value,
  onValueChange,
  clearOnReselect = false,
}: ColorSwatchRadioGroupProps) {
  return (
    <RadioGroup
      aria-label="Color"
      value={value}
      onValueChange={onValueChange}
      className="flex flex-wrap gap-1.5"
    >
      {options.map((option) => (
        <Radio.Root
          key={option.hex}
          value={option.hex}
          aria-label={option.name}
          onClick={() => {
            if (clearOnReselect && value === option.hex) {
              onValueChange('')
            }
          }}
          className={cn(
            'size-5 shrink-0 rounded-none border-2 bg-(--swatch-color) p-0 transition-transform hover:bg-(--swatch-color) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            value === option.hex
              ? 'scale-110 border-foreground'
              : 'border-transparent hover:scale-110',
          )}
          style={
            { '--swatch-color': option.hex } as CSSProperties & {
              '--swatch-color': string
            }
          }
        />
      ))}
    </RadioGroup>
  )
}

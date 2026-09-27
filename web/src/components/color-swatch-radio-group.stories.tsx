import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'

import { ColorSwatchRadioGroup } from '#components/color-swatch-radio-group'
import { makeColorSwatchOption } from '#components/color-swatch-radio-group-test-fixtures'

const options = [
  makeColorSwatchOption(),
  makeColorSwatchOption({ name: 'Sage', hex: '#74A882' }),
  makeColorSwatchOption({ name: 'Ocean', hex: '#4B83C2' }),
  makeColorSwatchOption({ name: 'Grape', hex: '#9B69B5' }),
]

const meta = {
  title: 'Common/ColorSwatchRadioGroup',
  component: ColorSwatchRadioGroup,
  parameters: {
    layout: 'centered',
  },
  args: {
    options,
    value: '',
    onValueChange: fn(),
  },
} satisfies Meta<typeof ColorSwatchRadioGroup>

export default meta
type Story = StoryObj<typeof meta>

export const Unselected: Story = {
  name: 'no color is selected',
}

export const Selected: Story = {
  name: 'the ocean swatch is selected',
  args: {
    value: '#4B83C2',
  },
}

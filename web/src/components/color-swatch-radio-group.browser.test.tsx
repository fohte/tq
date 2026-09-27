import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { ColorSwatchRadioGroup } from '#components/color-swatch-radio-group'
import { makeColorSwatchOption } from '#components/color-swatch-radio-group-test-fixtures'

const options = [
  makeColorSwatchOption(),
  makeColorSwatchOption({ name: 'Sage', hex: '#74A882' }),
]

function InteractiveColorSwatchRadioGroup({
  clearOnReselect = false,
}: {
  clearOnReselect?: boolean
}) {
  const [value, setValue] = useState(options[0]?.hex ?? '')

  return (
    <ColorSwatchRadioGroup
      options={options}
      value={value}
      onValueChange={setValue}
      clearOnReselect={clearOnReselect}
    />
  )
}

function getSwatchStates() {
  return screen.getAllByRole('radio').map((radio) => ({
    name: radio.getAttribute('aria-label'),
    checked: radio.getAttribute('aria-checked') === 'true',
  }))
}

describe('ColorSwatchRadioGroup', () => {
  it('keeps the selected color when it is selected again', async () => {
    const user = userEvent.setup()
    render(<InteractiveColorSwatchRadioGroup />)

    await user.click(screen.getByRole('radio', { name: 'Coral' }))

    expect(getSwatchStates()).toEqual([
      { name: 'Coral', checked: true },
      { name: 'Sage', checked: false },
    ])
  })

  it('clears the selected color when it is selected again', async () => {
    const user = userEvent.setup()
    render(<InteractiveColorSwatchRadioGroup clearOnReselect />)

    await user.click(screen.getByRole('radio', { name: 'Coral' }))

    expect(getSwatchStates()).toEqual([
      { name: 'Coral', checked: false },
      { name: 'Sage', checked: false },
    ])
  })

  it('moves the selected color with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<InteractiveColorSwatchRadioGroup />)

    await user.tab()
    await user.keyboard('{ArrowRight}')

    expect(getSwatchStates()).toEqual([
      { name: 'Coral', checked: false },
      { name: 'Sage', checked: true },
    ])
  })
})

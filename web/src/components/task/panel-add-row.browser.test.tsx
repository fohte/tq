import { render, screen } from '@testing-library/react'
import { Plus } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { PanelAddRow } from '#components/task/panel-add-row'

describe('PanelAddRow', () => {
  it('keeps the action button at least 44px tall', () => {
    render(
      <PanelAddRow icon={Plus} label="add item" onClick={() => undefined} />,
    )

    const height = screen
      .getByRole('button', { name: 'add item' })
      .getBoundingClientRect().height

    expect(height >= 44).toBe(true)
  })

  it('centers a trailing action in the row', () => {
    render(
      <PanelAddRow
        icon={Plus}
        label="add item"
        onClick={() => undefined}
        trailing={<span className="block size-5" data-testid="trailing" />}
      />,
    )

    const buttonRect = screen
      .getByRole('button', { name: 'add item' })
      .getBoundingClientRect()
    const trailingRect = screen.getByTestId('trailing').getBoundingClientRect()
    const centerOffset = Math.abs(
      buttonRect.top +
        buttonRect.height / 2 -
        (trailingRect.top + trailingRect.height / 2),
    )

    expect(centerOffset < 1).toBe(true)
  })
})

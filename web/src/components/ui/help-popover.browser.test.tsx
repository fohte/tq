import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { HelpPopover } from '#components/ui/help-popover'

describe('HelpPopover', () => {
  it('keeps muted text color while hovered and expanded', async () => {
    const user = userEvent.setup()
    render(
      <HelpPopover label="Show example help" tone="muted">
        Short help content.
      </HelpPopover>,
    )
    const button = screen.getByRole('button', { name: 'Show example help' })
    const initialColor = getComputedStyle(button).color
    const initialExpanded = String(button.getAttribute('aria-expanded'))

    await user.hover(button)
    const hoveredColor = getComputedStyle(button).color
    const hoveredExpanded = String(button.getAttribute('aria-expanded'))

    await user.click(button)
    const expandedColor = getComputedStyle(button).color
    const expanded = String(button.getAttribute('aria-expanded'))

    const actual = `${initialExpanded}|${initialColor}|${hoveredExpanded}|${hoveredColor}|${expanded}|${expandedColor}`
    expect(actual).toBe(
      `false|${initialColor}|false|${initialColor}|true|${initialColor}`,
    )
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PrioritySelect } from '#components/task/priority-select'
import { makePrioritySettings } from '#components/task/priority-settings-test-fixtures'

describe('PrioritySelect', () => {
  it('shows the configured label in the closed trigger', () => {
    render(
      <PrioritySelect
        value={1}
        settings={makePrioritySettings()}
        onValueChange={() => {}}
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Priority' })

    expect(trigger.textContent).toEqual('Next')
  })

  it('focuses the trigger when requested', () => {
    render(
      <PrioritySelect
        value={1}
        settings={makePrioritySettings()}
        onValueChange={() => {}}
        autoFocusTrigger
      />,
    )

    const trigger = screen.getByRole('combobox', { name: 'Priority' })

    expect(document.activeElement).toBe(trigger)
  })
})

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Input } from '#components/ui/input'
import { ExpandableFieldChip } from '#components/ui/modal-field'
import { ExpandableContextChipDemo } from '#components/ui/modal-field.stories'
import { clickSelectOption } from '#lib/test-utils'

describe('ExpandableFieldChip', () => {
  it('expands when the collapsed trigger is clicked', async () => {
    const user = userEvent.setup()
    render(
      <ExpandableFieldChip
        icon={null}
        label="Start"
        expanded={() => <Input type="date" defaultValue="2026-08-01" />}
      />,
    )

    expect(screen.queryByDisplayValue('2026-08-01')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Start' }))

    expect(screen.getByDisplayValue('2026-08-01')).toBeVisible()
  })

  it('collapses back to the picked label after selecting an option', async () => {
    const user = userEvent.setup()
    render(<ExpandableContextChipDemo />)

    await user.click(screen.getByRole('button', { name: 'Context' }))
    await user.click(screen.getByRole('combobox'))
    await clickSelectOption(
      user,
      await screen.findByRole('option', { name: 'Work' }),
    )

    // Picking a value closes the chip via the `close()` callback rather than
    // its blur handler, so the collapsed label updates immediately.
    expect(screen.getByRole('button', { name: 'Work' })).toBeVisible()
  })
})

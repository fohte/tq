import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FilterOptionButton } from '#components/ui/filter-option-button'

describe('FilterOptionButton', () => {
  it('calls onClick when clicked', async () => {
    const onClick = vi.fn()
    const user = userEvent.setup()
    render(
      <FilterOptionButton active={false} onClick={onClick}>
        All projects
      </FilterOptionButton>,
    )

    await user.click(screen.getByRole('button', { name: 'All projects' }))

    expect(onClick).toHaveBeenCalled()
  })
})

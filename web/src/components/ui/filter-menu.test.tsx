import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FilterMenu } from '#components/ui/filter-menu'

// test-setup.ts defaults window.matchMedia to desktop (matches: true);
// reset it before each test so mobile-simulating tests don't leak.
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
})

describe('FilterMenu', () => {
  it('opens a dropdown menu on desktop', async () => {
    const user = userEvent.setup()
    render(
      <FilterMenu trigger="+ filter" title="Filter">
        <div>content</div>
      </FilterMenu>,
    )

    await user.click(screen.getByRole('button', { name: '+ filter' }))

    expect(await screen.findByRole('menu')).toBeInTheDocument()
  })

  it('opens a bottom sheet dialog on mobile', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })
    const user = userEvent.setup()
    render(
      <FilterMenu trigger="+ filter" title="Filter">
        <div>content</div>
      </FilterMenu>,
    )

    await user.click(screen.getByRole('button', { name: '+ filter' }))

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Filter')).toBeInTheDocument()
  })
})

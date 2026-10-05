import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react'
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

function getFilterMenuState(outside: HTMLButtonElement) {
  return {
    popupText: screen.queryByText('popover content')?.textContent ?? null,
    focusMovedOutside: document.activeElement === outside,
  }
}

describe('FilterMenu', () => {
  it('opens a popover on desktop', async () => {
    const user = userEvent.setup()
    render(
      <FilterMenu trigger="+ filter" title="Filter">
        <div>content</div>
      </FilterMenu>,
    )

    await user.click(screen.getByRole('button', { name: '+ filter' }))

    expect(await screen.findByText('content')).toBeInTheDocument()
  })

  it('closes the open popover when its anchor is clicked', async () => {
    const user = userEvent.setup()
    render(
      <FilterMenu trigger="+ filter" title="Filter" defaultOpen>
        <button type="button">popover content</button>
      </FilterMenu>,
    )

    const content = await screen.findByRole('button', {
      name: 'popover content',
    })
    const contentRemoved = waitForElementToBeRemoved(content)
    await user.click(screen.getByRole('button', { name: '+ filter' }))

    await expect(contentRemoved).resolves.toBeUndefined()
  })

  it('stays open when focus moves from its anchor to another control', () => {
    render(
      <>
        <FilterMenu trigger="+ filter" title="Filter" defaultOpen>
          <div>popover content</div>
        </FilterMenu>
        <button type="button">outside</button>
      </>,
    )

    const trigger = screen.getByRole('button', { name: '+ filter' })
    const outside = screen.getByRole('button', { name: 'outside' })
    trigger.focus()
    outside.focus()

    expect(getFilterMenuState(outside)).toEqual({
      popupText: 'popover content',
      focusMovedOutside: true,
    })
  })

  it('closes the open popover after an outside press', async () => {
    const user = userEvent.setup()
    render(
      <>
        <FilterMenu trigger="+ filter" title="Filter" defaultOpen>
          <div>popover content</div>
        </FilterMenu>
        <button type="button">outside</button>
      </>,
    )

    const content = await screen.findByText('popover content')
    const contentRemoved = waitForElementToBeRemoved(content)
    await user.click(screen.getByRole('button', { name: 'outside' }))

    await expect(contentRemoved).resolves.toBeUndefined()
  })

  it('closes the open popover on Escape from inside its content', async () => {
    const user = userEvent.setup()
    render(
      <FilterMenu trigger="+ filter" title="Filter" defaultOpen>
        <button type="button">popover content</button>
      </FilterMenu>,
    )

    const content = await screen.findByRole('button', {
      name: 'popover content',
    })
    const contentRemoved = waitForElementToBeRemoved(content)
    await user.click(content)
    await user.keyboard('{Escape}')

    await expect(contentRemoved).resolves.toBeUndefined()
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

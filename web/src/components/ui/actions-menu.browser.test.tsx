import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from '@vitest/browser/context'
import { Kanban, List, Pencil, Trash2 } from 'lucide-react'
import { describe, expect, it, vi } from 'vitest'

import { ActionsMenu } from '#components/ui/actions-menu'
import { assertDefined } from '#lib/test-utils'
import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

const items = [
  { icon: <Pencil className="h-4 w-4" />, label: 'rename…', onClick: vi.fn() },
  {
    icon: <Trash2 className="h-4 w-4" />,
    label: 'delete…',
    onClick: vi.fn(),
    destructive: true,
  },
]

describe('ActionsMenu', () => {
  it('does not render items until a trigger is opened', () => {
    render(<ActionsMenu items={items} />)

    expect(screen.queryByText('rename…')).not.toBeInTheDocument()
  })

  it('opens the dropdown menu on the desktop trigger click', async () => {
    const user = userEvent.setup()
    const { container } = render(<ActionsMenu items={items} />)
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )

    await user.click(trigger)

    expect(await screen.findByText('rename…')).toBeInTheDocument()
    expect(screen.getByText('delete…')).toBeInTheDocument()
  })

  it('opens the action sheet on the mobile trigger click', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const user = userEvent.setup()
    const { container } = render(<ActionsMenu items={items} />)
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="action-sheet-trigger"]',
      ),
      'mobile trigger not found',
    )

    await user.click(trigger)

    expect(await screen.findByText('rename…')).toBeInTheDocument()
    expect(screen.getByText('delete…')).toBeInTheDocument()
  })

  it('does not bubble an outside dropdown click to a row link', async () => {
    const user = userEvent.setup()
    const rowClick = vi.fn()
    const rowMouseDown = vi.fn()
    const rowPointerDown = vi.fn()
    const linkClick = vi.fn()
    const linkMouseDown = vi.fn()
    const linkPointerDown = vi.fn()
    render(
      <a
        href="/tasks/example"
        onMouseDown={linkMouseDown}
        onPointerDown={linkPointerDown}
        onClick={(event) => {
          event.preventDefault()
          linkClick()
        }}
      >
        <div
          onClick={rowClick}
          onMouseDown={rowMouseDown}
          onPointerDown={rowPointerDown}
        >
          <ActionsMenu items={items} defaultOpen="desktop" />
        </div>
      </a>,
    )

    await screen.findByText('rename…')
    const backdrop = assertDefined(
      document.elementFromPoint(window.innerWidth - 1, window.innerHeight - 1),
      'dropdown backdrop not found at viewport corner',
    )
    await user.click(backdrop)

    function getInteractionResult() {
      return [
        ['dropdownOpen', screen.queryByText('rename…') != null],
        ['rowClickCount', rowClick.mock.calls.length],
        ['rowMouseDownCount', rowMouseDown.mock.calls.length],
        ['rowPointerDownCount', rowPointerDown.mock.calls.length],
        ['linkClickCount', linkClick.mock.calls.length],
        ['linkMouseDownCount', linkMouseDown.mock.calls.length],
        ['linkPointerDownCount', linkPointerDown.mock.calls.length],
      ]
    }

    await waitFor(() => {
      expect(getInteractionResult()).toEqual([
        ['dropdownOpen', false],
        ['rowClickCount', 0],
        ['rowMouseDownCount', 0],
        ['rowPointerDownCount', 0],
        ['linkClickCount', 0],
        ['linkMouseDownCount', 0],
        ['linkPointerDownCount', 0],
      ])
    })
  })

  it('shows a checkmark only on the selected item', async () => {
    const user = userEvent.setup()
    const { container } = render(
      <ActionsMenu
        items={[
          {
            icon: <List className="h-4 w-4" />,
            label: 'List',
            onClick: vi.fn(),
            selected: true,
          },
          {
            icon: <Kanban className="h-4 w-4" />,
            label: 'Board',
            onClick: vi.fn(),
            selected: false,
          },
        ]}
      />,
    )
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )

    await user.click(trigger)

    const listItem = assertDefined(
      (await screen.findByText('List')).closest(
        '[data-slot="dropdown-menu-item"]',
      ),
      'List item not found',
    )
    const boardItem = assertDefined(
      screen.getByText('Board').closest('[data-slot="dropdown-menu-item"]'),
      'Board item not found',
    )
    expect(listItem.querySelectorAll('svg')).toHaveLength(2)
    expect(boardItem.querySelectorAll('svg')).toHaveLength(1)
  })

  it('hides the mobile trigger when mobileItems is empty', () => {
    const { container } = render(<ActionsMenu items={items} mobileItems={[]} />)

    expect(
      container.querySelector('[data-slot="action-sheet-trigger"]'),
    ).not.toBeInTheDocument()
    expect(
      container.querySelector('[data-slot="dropdown-menu-trigger"]'),
    ).toBeInTheDocument()
  })
})

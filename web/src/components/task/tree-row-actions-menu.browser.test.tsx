import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { page } from '@vitest/browser/context'
import { describe, expect, it, vi } from 'vitest'

import { TreeRowActionsMenu } from '#components/task/tree-row-actions-menu'
import { assertDefined } from '#lib/test-utils'
import { MOBILE_VIEWPORT } from '#storybook-config/screenshot-viewports'

function renderMenu() {
  return render(
    <TreeRowActionsMenu
      onAddSubtask={vi.fn()}
      onLinkExisting={vi.fn()}
      onMoveUnder={vi.fn()}
      onSetProject={vi.fn()}
      onDelete={vi.fn()}
    />,
  )
}

function expectAllItemsVisible() {
  expect(screen.getByText('add subtask')).toBeInTheDocument()
  expect(screen.getByText('link existing task…')).toBeInTheDocument()
  expect(screen.getByText('move under…')).toBeInTheDocument()
  expect(screen.getByText('set project…')).toBeInTheDocument()
  expect(screen.getByText('delete…')).toBeInTheDocument()
}

describe('TreeRowActionsMenu', () => {
  it('does not render items until opened', () => {
    renderMenu()

    expect(screen.queryByText('add subtask')).not.toBeInTheDocument()
  })

  it('opens the dropdown menu on the desktop trigger click, showing every item', async () => {
    const user = userEvent.setup()
    const { container } = renderMenu()
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="dropdown-menu-trigger"]',
      ),
      'desktop trigger not found',
    )

    await user.click(trigger)

    expect(await screen.findByText('add subtask')).toBeInTheDocument()
    expectAllItemsVisible()
  })

  it('opens the action sheet on the mobile trigger click, showing every item', async () => {
    await page.viewport(MOBILE_VIEWPORT.width, MOBILE_VIEWPORT.height)
    const user = userEvent.setup()
    const { container } = renderMenu()
    const trigger = assertDefined(
      container.querySelector<HTMLElement>(
        '[data-slot="action-sheet-trigger"]',
      ),
      'mobile trigger not found',
    )

    await user.click(trigger)

    expect(await screen.findByText('add subtask')).toBeInTheDocument()
    expectAllItemsVisible()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResizablePaneSeparator } from '#components/ui/resizable-pane-separator'

function ResizablePaneFixture({
  initialWidth = 300,
  onValueCommit = () => {},
}: {
  initialWidth?: number
  onValueCommit?: (value: number) => void
}) {
  const [width, setWidth] = useState(initialWidth)

  return (
    <div className="relative h-64">
      <ResizablePaneSeparator
        label="Resize pane"
        value={width}
        min={240}
        max={500}
        onValueChange={setWidth}
        onValueCommit={onValueCommit}
      />
    </div>
  )
}

describe('ResizablePaneSeparator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('changes the pane width to match pointer movement', () => {
    vi.spyOn(HTMLElement.prototype, 'setPointerCapture').mockImplementation(
      () => {},
    )

    const onValueCommit = vi.fn()
    render(<ResizablePaneFixture onValueCommit={onValueCommit} />)
    const separator = screen.getByRole('separator', { name: 'Resize pane' })
    fireEvent.pointerDown(separator, {
      button: 0,
      clientX: 100,
      pointerId: 1,
    })
    fireEvent.pointerMove(separator, { clientX: 145, pointerId: 1 })
    fireEvent.pointerUp(separator, {
      clientX: 145,
      pointerId: 1,
    })

    const getResult = () => ({
      value: separator.getAttribute('aria-valuenow'),
      commits: onValueCommit.mock.calls,
    })
    expect(getResult()).toEqual({
      value: '345',
      commits: [[345]],
    })
  })

  it('changes the pane width with the arrow keys', async () => {
    const user = userEvent.setup()
    render(<ResizablePaneFixture />)
    const separator = screen.getByRole('separator', { name: 'Resize pane' })
    separator.focus()

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowLeft}')

    expect(separator.getAttribute('aria-valuenow')).toEqual('310')
  })

  it('moves to the minimum width with the Home key', async () => {
    const user = userEvent.setup()
    render(<ResizablePaneFixture />)
    const separator = screen.getByRole('separator', { name: 'Resize pane' })
    separator.focus()

    await user.keyboard('{Home}')

    expect(separator.getAttribute('aria-valuenow')).toEqual('240')
  })

  it('moves to the maximum width with the End key', async () => {
    const user = userEvent.setup()
    render(<ResizablePaneFixture />)
    const separator = screen.getByRole('separator', { name: 'Resize pane' })
    separator.focus()

    await user.keyboard('{End}')

    expect(separator.getAttribute('aria-valuenow')).toEqual('500')
  })

  it('uses a larger step with Shift and commits keyboard changes', async () => {
    const user = userEvent.setup()
    const onValueCommit = vi.fn()
    render(<ResizablePaneFixture onValueCommit={onValueCommit} />)
    const separator = screen.getByRole('separator', { name: 'Resize pane' })
    separator.focus()

    await user.keyboard('{Shift>}{ArrowRight}{/Shift}')

    const getResult = () => ({
      value: separator.getAttribute('aria-valuenow'),
      commits: onValueCommit.mock.calls,
    })
    expect(getResult()).toEqual({
      value: '350',
      commits: [[350]],
    })
  })
})

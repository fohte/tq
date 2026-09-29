import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ResizablePaneSeparator } from '#components/ui/resizable-pane-separator'

function ResizablePaneFixture({
  initialWidth = 300,
}: {
  initialWidth?: number
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

    render(<ResizablePaneFixture />)
    const separator = screen.getByRole('separator', { name: 'Resize pane' })
    fireEvent.pointerDown(separator, {
      button: 0,
      clientX: 100,
      pointerId: 1,
    })
    fireEvent.pointerMove(separator, { clientX: 145, pointerId: 1 })
    fireEvent.pointerUp(separator, { pointerId: 1 })

    expect(separator.getAttribute('aria-valuenow')).toEqual('345')
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
})

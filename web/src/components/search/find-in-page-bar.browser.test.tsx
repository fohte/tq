import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FindInPageBar } from '#components/search/find-in-page-bar'

function getSelectedMatchId(): string | null {
  return window.getSelection()?.anchorNode?.parentElement?.id ?? null
}

describe('FindInPageBar', () => {
  it('Enter moves to the next match and Shift+Enter moves to the previous match', async () => {
    const user = userEvent.setup()
    render(
      <>
        <p id="first-match">silver meadow</p>
        <p id="second-match">silver meadow</p>
        <FindInPageBar open requestId={0} onClose={() => undefined} />
      </>,
    )
    const input = screen.getByRole('textbox', { name: 'Find in page' })
    const matchIds: (string | null)[] = []

    await user.type(input, 'meadow')
    await user.keyboard('{Enter}')
    matchIds.push(getSelectedMatchId())
    await user.keyboard('{Enter}')
    matchIds.push(getSelectedMatchId())
    await user.keyboard('{Shift>}{Enter}{/Shift}')
    matchIds.push(getSelectedMatchId())

    expect(matchIds).toEqual(['first-match', 'second-match', 'first-match'])
  })

  it('Escape asks the parent to close the find bar', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<FindInPageBar open requestId={0} onClose={onClose} />)
    const input = screen.getByRole('textbox', { name: 'Find in page' })

    await user.type(input, 'meadow')
    await user.keyboard('{Escape}')

    expect(onClose.mock.calls).toEqual([[]])
  })
})

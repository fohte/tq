import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SessionOpenSettingsPanel } from '#components/settings/session-open-settings-panel'

describe('SessionOpenSettingsPanel', () => {
  it('updates the input as the user types a focus template', async () => {
    const user = userEvent.setup()
    render(<SessionOpenSettingsPanel />)
    const input = screen.getByPlaceholderText(
      'hammerspoon://cc-focus?session={sessionId}',
    )

    // user-event treats `{` as special key syntax, so a literal `{` needs to
    // be escaped by doubling it (the matching `}` needs no escaping):
    // https://testing-library.com/docs/user-event/utility/#special-characters
    await user.type(input, 'tq://focus?session={{sessionId}')

    expect(input).toHaveValue('tq://focus?session={sessionId}')
  })
})

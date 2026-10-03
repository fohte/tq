import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  type GitHubNotifyEvent,
  GitHubNotifyEventsPicker,
} from '#components/task/github-notify-events-picker'

function ControlledPicker({
  onChange,
}: {
  onChange: (value: GitHubNotifyEvent[]) => void
}) {
  const [value, setValue] = useState<GitHubNotifyEvent[]>([])

  return (
    <GitHubNotifyEventsPicker
      value={value}
      onChange={(nextValue) => {
        onChange(nextValue)
        setValue(nextValue)
      }}
    />
  )
}

describe('GitHubNotifyEventsPicker', () => {
  it('emits the selected events in display order while the menu stays open', async () => {
    const changes: GitHubNotifyEvent[][] = []
    const user = userEvent.setup()
    render(<ControlledPicker onChange={(value) => changes.push(value)} />)

    await user.click(screen.getByRole('button', { name: 'Notify on: off' }))
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'closed / merged' }),
    )
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'new comments' }),
    )

    expect(changes).toEqual([['closed'], ['closed', 'comments']])
  })
})

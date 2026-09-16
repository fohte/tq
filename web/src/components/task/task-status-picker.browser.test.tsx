import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskStatusPicker } from '#components/task/task-status-picker'

describe('TaskStatusPicker', () => {
  it('calls onValueChange with the clicked status', async () => {
    const onValueChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskStatusPicker
        status="todo"
        statusReason={null}
        onValueChange={onValueChange}
      />,
    )

    await user.click(screen.getByLabelText('Change task status'))
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'Completed' }),
    )

    // Base UI's RadioGroup passes a second `eventDetails` argument alongside the value
    expect(onValueChange).toHaveBeenCalledWith('completed', expect.anything())
  })

  it('checks the "Not planned" item when statusReason is not_planned', () => {
    render(
      <TaskStatusPicker
        status="completed"
        statusReason="not_planned"
        onValueChange={vi.fn()}
        defaultOpen
      />,
    )

    expect(
      screen.getByRole('menuitemradio', { name: 'Not planned' }),
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('checks the "Duplicate" item when statusReason is duplicate', () => {
    render(
      <TaskStatusPicker
        status="completed"
        statusReason="duplicate"
        onValueChange={vi.fn()}
        defaultOpen
      />,
    )

    expect(
      screen.getByRole('menuitemradio', { name: 'Duplicate' }),
    ).toHaveAttribute('aria-checked', 'true')
  })
})

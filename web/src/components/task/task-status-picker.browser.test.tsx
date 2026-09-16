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
})

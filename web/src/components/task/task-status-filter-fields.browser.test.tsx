import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { TaskStatusFilterFields } from '#components/task/task-status-filter-fields'

describe('TaskStatusFilterFields', () => {
  it('checks an unchecked status', async () => {
    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskStatusFilterFields
        status={['todo']}
        onStatusChange={onStatusChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Completed' }))

    expect(onStatusChange).toHaveBeenCalledWith(['todo', 'completed'])
  })

  it('unchecks a status when another remains checked', async () => {
    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskStatusFilterFields
        status={['todo', 'completed']}
        onStatusChange={onStatusChange}
      />,
    )

    await user.click(screen.getByRole('checkbox', { name: 'Todo' }))

    expect(onStatusChange).toHaveBeenCalledWith(['completed'])
  })

  it('disables the last remaining checked status', async () => {
    const onStatusChange = vi.fn()
    const user = userEvent.setup()
    render(
      <TaskStatusFilterFields
        status={['todo']}
        onStatusChange={onStatusChange}
      />,
    )

    const checkbox = screen.getByRole('checkbox', { name: 'Todo' })
    expect(checkbox).toHaveAttribute('aria-disabled', 'true')

    await user.click(checkbox)

    expect(onStatusChange).not.toHaveBeenCalled()
  })
})

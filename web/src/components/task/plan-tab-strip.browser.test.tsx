import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlanTabStrip } from '#components/task/plan-tab-strip'

describe('PlanTabStrip', () => {
  it('calls onChange with the clicked tab value', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PlanTabStrip value="" onChange={onChange} />)

    await user.click(screen.getByText('today'))

    expect(onChange).toHaveBeenCalledWith('day')
  })

  it('marks the tab matching value as pressed', () => {
    render(<PlanTabStrip value="day" onChange={vi.fn()} />)

    expect(screen.getByText('today')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('this week')).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('does not call onChange when disabled', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<PlanTabStrip value="" onChange={onChange} disabled />)

    await user.click(screen.getByText('today'))

    expect(onChange).not.toHaveBeenCalled()
  })
})

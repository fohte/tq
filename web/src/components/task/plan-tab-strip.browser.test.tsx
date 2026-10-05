import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PlanTabStrip } from '#components/task/plan-tab-strip'

describe('PlanTabStrip', () => {
  it('calls onChange with the clicked tab value', async () => {
    const changes: string[] = []
    const user = userEvent.setup()
    render(<PlanTabStrip value="" onChange={(value) => changes.push(value)} />)

    await user.click(screen.getByText('today'))

    expect(changes).toEqual(['day'])
  })

  it('marks the tab matching value as pressed', () => {
    render(<PlanTabStrip value="day" onChange={vi.fn()} />)

    expect(
      screen.getAllByRole('button').map((button) => ({
        label: button.textContent,
        pressed: button.getAttribute('aria-pressed'),
      })),
    ).toEqual([
      { label: '—', pressed: 'false' },
      { label: 'today', pressed: 'true' },
      { label: 'this week', pressed: 'false' },
    ])
  })

  it('disables the options when disabled', () => {
    render(<PlanTabStrip value="" onChange={vi.fn()} disabled />)

    expect(
      screen.getAllByRole('button').map((button) => ({
        label: button.textContent,
        disabled: button.getAttribute('disabled') !== null,
      })),
    ).toEqual([
      { label: '—', disabled: true },
      { label: 'today', disabled: true },
      { label: 'this week', disabled: true },
    ])
  })
})

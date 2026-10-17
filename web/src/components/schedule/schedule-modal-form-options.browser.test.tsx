import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WeekdayToggleRow } from '#components/schedule/schedule-modal-form-options'

describe('WeekdayToggleRow', () => {
  it('exposes selected weekdays through aria-pressed', () => {
    render(<WeekdayToggleRow daysOfWeek={[1, 3, 5]} toggleDay={vi.fn()} />)

    expect(
      screen.getAllByRole('button').map((button) => ({
        label: button.textContent,
        pressed: button.getAttribute('aria-pressed'),
      })),
    ).toEqual([
      { label: 'S', pressed: 'false' },
      { label: 'M', pressed: 'true' },
      { label: 'T', pressed: 'false' },
      { label: 'W', pressed: 'true' },
      { label: 'T', pressed: 'false' },
      { label: 'F', pressed: 'true' },
      { label: 'S', pressed: 'false' },
    ])
  })
})

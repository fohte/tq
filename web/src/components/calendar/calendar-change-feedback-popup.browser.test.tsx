import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  type CalendarChangeFeedback,
  CalendarChangeFeedbackPopup,
} from '#components/calendar/calendar-change-feedback-popup'

function TestSubject({
  feedback,
  onOpenChange,
}: {
  feedback: CalendarChangeFeedback | null
  onOpenChange: (open: boolean) => void
}) {
  const anchorRef = useRef<HTMLDivElement>(null)

  return (
    <div>
      <div ref={anchorRef}>anchor</div>
      <CalendarChangeFeedbackPopup
        anchor={anchorRef}
        feedback={feedback}
        onOpenChange={onOpenChange}
      />
    </div>
  )
}

describe('CalendarChangeFeedbackPopup', () => {
  it('calls onUndo when the Undo button is clicked', async () => {
    const onUndo = vi.fn()
    const user = userEvent.setup()
    render(
      <TestSubject
        feedback={{ kind: 'undo', onUndo }}
        onOpenChange={vi.fn()}
      />,
    )

    await user.click(await screen.findByRole('button', { name: 'Undo' }))

    expect(onUndo).toHaveBeenCalledOnce()
  })
})

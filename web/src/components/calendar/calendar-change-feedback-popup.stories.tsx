import type { Meta, StoryObj } from '@storybook/react-vite'
import { useRef } from 'react'
import { fn } from 'storybook/test'

import {
  type CalendarChangeFeedback,
  CalendarChangeFeedbackPopup,
} from '#components/calendar/calendar-change-feedback-popup'

function CalendarChangeFeedbackPopupDemo({
  feedback,
  onOpenChange,
}: {
  feedback: CalendarChangeFeedback | null
  onOpenChange: (open: boolean) => void
}) {
  const anchorRef = useRef<HTMLDivElement>(null)

  return (
    <div className="w-40">
      <div
        ref={anchorRef}
        className="rounded-md bg-surface-strong px-2 py-1.5 text-xs text-primary-foreground"
      >
        Write the report
      </div>
      <CalendarChangeFeedbackPopup
        anchor={anchorRef}
        feedback={feedback}
        onOpenChange={onOpenChange}
      />
    </div>
  )
}

const meta = {
  title: 'Calendar/CalendarChangeFeedbackPopup',
  component: CalendarChangeFeedbackPopupDemo,
  parameters: {
    layout: 'centered',
  },
  args: {
    onOpenChange: fn(),
  },
} satisfies Meta<typeof CalendarChangeFeedbackPopupDemo>

export default meta
type Story = StoryObj<typeof meta>

export const ShowsUndo: Story = {
  args: {
    feedback: { kind: 'undo', onUndo: fn() },
  },
}

export const ShowsError: Story = {
  args: {
    feedback: { kind: 'error' },
  },
}

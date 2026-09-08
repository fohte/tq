import type { Meta, StoryObj } from '@storybook/react-vite'

import { GcalStatusBand } from '#components/calendar/event-block'

function GcalStatusBandPreview({
  title = '退勤',
  gcalEventType = 'outOfOffice',
}: {
  title?: string
  gcalEventType?: string
}) {
  const arg = {
    event: {
      title,
      extendedProps: { gcalEventType },
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- story mock data doesn't match full EventContentArg
  const props = arg as unknown as Parameters<typeof GcalStatusBand>[0]

  return (
    // Mirrors fullcalendar.css's `.fc-bg-event` to preview the band outside of FullCalendar.
    <div
      className="flex h-24 w-72 items-center justify-center border-y border-muted-foreground-ghost bg-card"
      style={{ backgroundImage: 'var(--calendar-status-band-fill)' }}
    >
      <GcalStatusBand {...props} />
    </div>
  )
}

const meta = {
  title: 'Calendar/GcalStatusBand',
  component: GcalStatusBandPreview,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof GcalStatusBandPreview>

export default meta
type Story = StoryObj<typeof meta>

export const OutOfOffice: Story = {
  args: {
    title: '退勤',
    gcalEventType: 'outOfOffice',
  },
}

export const FocusTime: Story = {
  args: {
    title: '集中作業',
    gcalEventType: 'focusTime',
  },
}
